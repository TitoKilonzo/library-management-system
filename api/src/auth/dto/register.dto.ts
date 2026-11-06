import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// Note: there is deliberately no `role` field. With `whitelist: true`, a client
// that sends { "role": "LIBRARIAN" } has it stripped, so public registration
// can only ever create PATRON accounts.
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // bcrypt only uses the first 72 bytes of a password, so cap it there.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
