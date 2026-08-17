import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(POOL) private pool: Pool,
    private jwt: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const [rows]: any = await this.pool.query('SELECT * FROM usuarios WHERE email = ?', [String(email || '').trim().toLowerCase()]);
    const usuario = rows[0];
    if (!usuario || !usuario.ativo || !(await bcrypt.compare(String(senha || ''), usuario.senha_hash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const token = await this.jwt.signAsync({ sub: usuario.id, email: usuario.email });
    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      empresas: await this.empresasDoUsuario(usuario),
    };
  }

  async empresasDoUsuario(usuario: { id: number; papel: string }) {
    if (usuario.papel === 'admin') {
      const [rows]: any = await this.pool.query('SELECT * FROM empresas ORDER BY id');
      return rows;
    }
    const [rows]: any = await this.pool.query(
      `SELECT e.* FROM empresas e
       JOIN usuario_empresas ue ON ue.empresa_id = e.id
       WHERE ue.usuario_id = ? ORDER BY e.id`,
      [usuario.id],
    );
    return rows;
  }
}
