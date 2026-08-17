import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { POOL, Pool } from '../db/database.module';
import { IS_PUBLIC, PAPEIS } from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
    @Inject(POOL) private pool: Pool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    // Downloads (Excel/PDF/XML) enviam o token via query string
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string);
    if (!token) throw new UnauthorizedException('Token ausente');

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    const [urows]: any = await this.pool.query(
      'SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = ?',
      [payload.sub],
    );
    const usuario = urows[0];
    if (!usuario || !usuario.ativo) throw new UnauthorizedException('Usuário inativo');

    let empresaRows: any[];
    if (usuario.papel === 'admin') {
      [empresaRows] = (await this.pool.query('SELECT id FROM empresas ORDER BY id')) as any;
    } else {
      [empresaRows] = (await this.pool.query(
        'SELECT empresa_id AS id FROM usuario_empresas WHERE usuario_id = ? ORDER BY empresa_id',
        [usuario.id],
      )) as any;
    }
    const ids: number[] = empresaRows.map((e: any) => Number(e.id));
    if (!ids.length) throw new ForbiddenException('Usuário sem empresa vinculada');

    const desejada = Number(req.headers['x-empresa-id'] || req.query.empresa || ids[0]);
    if (!ids.includes(desejada)) throw new ForbiddenException('Sem acesso a esta empresa');

    const papeis = this.reflector.getAllAndOverride<string[]>(PAPEIS, [ctx.getHandler(), ctx.getClass()]);
    if (papeis?.length && !papeis.includes(usuario.papel)) {
      throw new ForbiddenException('Permissão insuficiente para esta operação');
    }

    req.usuario = usuario;
    req.empresaId = desejada;
    req.empresaIds = ids;
    return true;
  }
}
