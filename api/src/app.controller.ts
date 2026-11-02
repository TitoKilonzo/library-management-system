import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus(): string {
    return 'Library Management API is running';
  }
}
