import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, UsuarioAtual } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email: string; senha: string }) {
    return this.auth.login(body.email, body.senha);
  }

  @Get('me')
  async me(@UsuarioAtual() usuario: any, @Req() req: any) {
    return {
      usuario,
      empresaId: req.empresaId,
      empresas: await this.auth.empresasDoUsuario(usuario),
    };
  }
}
