# Google OAuth Implementation Summary

## What Was Implemented

Google Sign-In (OAuth 2.0) authentication has been successfully integrated into the KotobaMichi backend using NestJS and Passport.js.

## Files Created/Modified

### New Files

1. **`src/auth/strategies/google.strategy.ts`**
   - Implements the Passport Google OAuth2.0 strategy
   - Validates Google user profiles
   - Calls `AuthService.validateOAuthUser()` to handle user creation/login

2. **`docs/GOOGLE_OAUTH_GUIDE.md`**
   - Comprehensive guide for Google OAuth setup
   - API documentation
   - Frontend integration examples
   - Troubleshooting tips

3. **`drizzle/migrations/0002_add_google_oauth_fields.sql`**
   - Database migration for OAuth fields
   - Makes password optional
   - Adds googleId, name, and picture columns

### Modified Files

1. **`src/auth/auth.service.ts`**
   - Added `validateOAuthUser()` method - handles finding/creating/linking Google users
   - Added `loginWithOAuth()` method - generates JWT tokens for OAuth users
   - Updated `login()` to check for OAuth-only users
   - Updated `changePassword()` to prevent OAuth-only users from setting passwords

2. **`src/auth/auth.controller.ts`**
   - Added `GET /auth/google` endpoint - initiates Google OAuth flow
   - Added `GET /auth/google/callback` endpoint - handles Google callback and token generation

3. **`src/auth/auth.module.ts`**
   - Imported and registered `GoogleStrategy` provider

4. **`src/db/schema.ts`**
   - Modified `users` table schema:
     - `password`: Made optional (nullable)
     - `googleId`: Added for Google user identification
     - `name`: Added for user's display name
     - `picture`: Added for profile picture URL

## Key Features

### 1. Multiple Authentication Flows

- **New Google users**: Creates account with Google credentials
- **Existing email users**: Links Google account to existing account
- **Returning Google users**: Logs in with Google ID

### 2. Security Features

- Email automatically verified for Google OAuth users
- OAuth-only users cannot use password login
- Existing users can link Google accounts
- JWT token generation and refresh token rotation
- HTTP-only cookies for token storage

### 3. Database Schema

- Backward compatible with existing password-based users
- Supports hybrid accounts (both password and Google)
- Stores Google profile information

## Environment Variables Required

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

## API Endpoints

| Method | Endpoint                | Description                                |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/auth/google`          | Initiates Google OAuth flow                |
| GET    | `/auth/google/callback` | Handles Google callback and returns tokens |

## How It Works

### User Flow

```
1. User clicks "Sign in with Google" button
   ↓
2. Frontend redirects to GET /auth/google
   ↓
3. Backend redirects to Google's OAuth consent screen
   ↓
4. User authorizes the application
   ↓
5. Google redirects to GET /auth/google/callback with auth code
   ↓
6. GoogleStrategy validates the code and fetches user profile
   ↓
7. AuthService.validateOAuthUser() creates/finds/links user
   ↓
8. AuthService.loginWithOAuth() generates JWT tokens
   ↓
9. Tokens are set as HTTP-only cookies and returned in response
   ↓
10. User is authenticated and can access protected routes
```

### Data Flow

```typescript
Google Profile → GoogleStrategy.validate()
                        ↓
                AuthService.validateOAuthUser()
                        ↓
            Creates/Finds/Links User in Database
                        ↓
                AuthService.loginWithOAuth()
                        ↓
            Generates Access & Refresh Tokens
                        ↓
                    Returns to Client
```

## Testing Checklist

- [ ] Set up Google OAuth credentials in Google Cloud Console
- [ ] Add environment variables to `.env`
- [ ] Run database migration: `pnpm drizzle-kit push` or run migrations script
- [ ] Start the backend: `pnpm start:dev`
- [ ] Test Google OAuth flow: Navigate to `http://localhost:3000/auth/google`
- [ ] Verify tokens are returned
- [ ] Test linking existing account (sign in with password, then with Google)
- [ ] Verify OAuth-only users cannot use password login

## Next Steps

1. **Run the migration**:

   ```bash
   pnpm drizzle-kit push
   # or
   ./scripts/run-migrations.sh
   ```

2. **Set up Google OAuth credentials**:
   - Follow the guide in `docs/GOOGLE_OAUTH_GUIDE.md`
   - Add credentials to `.env`

3. **Frontend Integration**:
   - Add "Sign in with Google" button
   - Redirect to `/auth/google` endpoint
   - Handle successful authentication (validate endpoint or cookie check)

4. **Production Deployment**:
   - Update Google OAuth redirect URIs for production domain
   - Set production environment variables
   - Ensure HTTPS is enabled
   - Configure CORS properly

## Dependencies Installed

```json
{
	"dependencies": {
		"passport-google-oauth20": "^2.x.x"
	},
	"devDependencies": {
		"@types/passport-google-oauth20": "^2.x.x"
	}
}
```

## References

- [NestJS Passport Documentation](https://docs.nestjs.com/recipes/passport)
- [Passport Google OAuth2.0 Strategy](https://github.com/jaredhanson/passport-google-oauth2)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

## Notes

- The implementation uses Context7 MCP to fetch up-to-date documentation for NestJS and Passport
- All changes maintain backward compatibility with existing authentication
- The code follows NestJS best practices and conventions
- Error handling includes specific messages for OAuth-only users
