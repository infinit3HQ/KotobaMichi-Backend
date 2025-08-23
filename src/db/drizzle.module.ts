import { Global, Module } from '@nestjs/common';
import { DbService } from './drizzle.service';

@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DrizzleModule {}
