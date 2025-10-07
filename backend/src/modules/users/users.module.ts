import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersSupabaseService } from './users-supabase.service';
import { User } from './entities/user.entity';
import { UserFavorite } from './entities/user-favorite.entity';
import { Content } from '../content/entities/content.entity';
import { FavoritesController } from './controllers/favorites.controller';
import { FavoritesService } from './services/favorites.service';
import { SupabaseModule } from '../../config/supabase.module';
import { optionalTypeOrmFeature, optionalTypeOrmProviders, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [UsersController, FavoritesController] : [UsersController];
const conditionalProviders = isTypeOrmEnabled() 
  ? [UsersService, FavoritesService]
  : [
      UsersSupabaseService,
      {
        provide: UsersService,
        useExisting: UsersSupabaseService,
      },
    ];

@Module({
  imports: [
    ...optionalTypeOrmFeature([User, UserFavorite, Content]),
    SupabaseModule,
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: [UsersService],
})
export class UsersModule {}