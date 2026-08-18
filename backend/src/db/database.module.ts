import { Global, Module, OnApplicationBootstrap, Inject } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';

export const POOL = 'MYSQL_POOL';
export type Pool = mysql.Pool;

const poolProvider = {
  provide: POOL,
  useFactory: async (): Promise<mysql.Pool> => {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'benio',
      password: process.env.DB_PASSWORD || 'benio123',
      database: process.env.DB_NAME || 'benio',
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      dateStrings: true,
      charset: 'utf8mb4',
    });
    // O MySQL pode demorar a aceitar conexões na primeira subida (roda os scripts de init)
    for (let tentativa = 1; ; tentativa++) {
      try {
        await pool.query('SELECT 1');
        console.log('[grimorium] MySQL conectado');
        return pool;
      } catch (e) {
        if (tentativa >= 60) throw e;
        if (tentativa % 5 === 1) console.log(`[grimorium] aguardando MySQL... (${tentativa})`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  },
};

@Global()
@Module({
  providers: [poolProvider],
  exports: [poolProvider],
})
export class DatabaseModule implements OnApplicationBootstrap {
  constructor(@Inject(POOL) private pool: mysql.Pool) {}

  // Cria o usuário administrador na primeira subida (senha com hash bcrypt)
  async onApplicationBootstrap() {
    // Checa se já existe um admin, e não se a tabela está vazia: o seed (02-seed.sql)
    // insere os funcionários antes do backend subir, o que impedia a criação do admin
    const [rows]: any = await this.pool.query(
      "SELECT COUNT(*) AS c FROM usuarios WHERE papel = 'admin'",
    );
    if (rows[0].c > 0) return;
    const hash = await bcrypt.hash('admin123', 10);
    const [res]: any = await this.pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?,?)',
      ['Administrador', 'admin@grimorium.com', hash, 'admin'],
    );
    const [empresas]: any = await this.pool.query('SELECT id FROM empresas');
    for (const e of empresas) {
      await this.pool.query('INSERT IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (?,?)', [res.insertId, e.id]);
    }
    console.log('[grimorium] usuário admin criado: admin@grimorium.com / admin123');
  }
}
