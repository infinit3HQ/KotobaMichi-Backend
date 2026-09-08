# Google OAuth Integration Guide

This guide explains how to set up and use Google Sign-In authentication in the KotobaMichi backend.

## Overview

The application now supports Google OAuth 2.0 authentication alongside traditional email/password authentication. Users can:

- Sign in with their Google account
- Link their Google account to an existing email/password account
- Use Google Sign-In exclusively (no password required)

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### Getting Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
6. Copy the Client ID and Client Secret to your `.env` file

## Database Changes

The `users` table has been updated to support Google OAuth:

- `password` - Now optional (nullable) for OAuth-only users
- `googleId` - Stores the Google user ID
- `name` - Stores the user's display name from Google
- `picture` - Stores the user's profile picture URL from Google

You'll need to run a migration to update your database schema.

## API Endpoints

### Initiate Google Sign-In

```
GET /auth/google
```

Redirects the user to Google's OAuth consent screen.

**Frontend Implementation:**

```typescript
// Redirect user to start Google auth flow
window.location.href = 'http://localhost:3000/auth/google';
```

### Google Callback

```
GET /auth/google/callback
```

Google redirects back to this endpoint after authentication. The endpoint:

1. Validates the Google user
2. Creates a new user or links to an existing account
3. Generates JWT tokens
4. Sets authentication cookies
5. Returns user data and tokens

**Response:**

```json
{
	"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"user": {
		"id": "user-id",
		"email": "user@example.com",
		"role": "USER"
	}
}
```

## Authentication Flow

### New User with Google

1. User clicks "Sign in with Google"
2. User is redirected to `/auth/google`
3. User authenticates with Google
4. Google redirects to `/auth/google/callback`
5. Backend creates a new user with:
   - `email` from Google
   - `googleId` from Google
   - `isEmailVerified: true` (Google verifies emails)
   - `password: null` (OAuth-only user)
6. JWT tokens are generated and returned

### Existing User Linking Google Account

If a user with the same email already exists:

1. The backend links the Google account to the existing user
2. Updates `googleId`, `name`, and `picture` fields
3. Sets `isEmailVerified: true`
4. Returns tokens for the existing account

### Returning Google User

If a user with the `googleId` already exists:

1. The backend logs them in
2. Generates new tokens
3. Returns user data

## Security Features

- **Email Verification**: Google OAuth users are automatically verified since Google verifies emails
- **Account Linking**: Existing users can link their Google account
- **Password Protection**: OAuth-only users cannot use password-based login
- **Token Rotation**: Refresh tokens are rotated on each use
- **HTTPS Required**: In production, cookies use `secure` flag

## Error Handling

### OAuth-Only User Trying Password Login

If a user created with Google tries to login with email/password:

```json
{
	"statusCode": 401,
	"message": "Please sign in with Google. This account was created with Google Sign-In."
}
```

### OAuth-Only User Trying to Change Password

```json
{
	"statusCode": 401,
	"message": "Cannot change password for OAuth-only accounts"
}
```

### Missing Google Profile Email

```json
{
	"statusCode": 401,
	"message": "No email found in Google profile"
}
```

## Frontend Integration Example

### React/Next.js Example

```typescript
// Google Sign-In Button Component
export function GoogleSignInButton() {
  const handleGoogleSignIn = () => {
    // Redirect to backend Google auth endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <button onClick={handleGoogleSignIn}>
      Sign in with Google
    </button>
  );
}
```

### Handling the Callback

You may want to redirect users after successful authentication:

**Option 1: Frontend Redirect**
Update the callback endpoint to redirect to your frontend with tokens in the URL (less secure, use with caution):

```typescript
// In the callback handler
res.redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
```

**Option 2: Cookie-Based (Recommended)**
The current implementation sets HTTP-only cookies, so your frontend can:

1. Detect successful login via the `/auth/validate` endpoint
2. Redirect to the dashboard or home page

```typescript
// After Google redirects back
useEffect(() => {
	const validateAuth = async () => {
		try {
			const response = await fetch('/auth/validate', {
				credentials: 'include', // Include cookies
			});
			if (response.ok) {
				// User is authenticated, redirect to dashboard
				router.push('/dashboard');
			}
		} catch (error) {
			// Handle error
		}
	};

	validateAuth();
}, []);
```

## Testing

### Manual Testing

1. Start your backend: `pnpm start:dev`
2. Visit: `http://localhost:3000/auth/google`
3. Sign in with a Google account
4. Check that you're redirected to the callback
5. Verify tokens are returned

### cURL Testing

```bash
# Initiate Google auth (will redirect)
curl -L http://localhost:3000/auth/google

# Validate auth (after successful login)
curl -X GET http://localhost:3000/auth/validate \
  --cookie "access_token=your-token; refresh_token=your-refresh-token"
```

## Production Considerations

1. **HTTPS**: Ensure your production environment uses HTTPS
2. **CORS**: Configure CORS to allow your frontend domain
3. **Environment Variables**: Set production Google OAuth credentials
4. **Callback URLs**: Update authorized redirect URIs in Google Cloud Console
5. **Cookie Settings**: Verify `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` for cross-domain setups

## Troubleshooting

### "redirect_uri_mismatch" Error

- Ensure the callback URL in your `.env` matches exactly what's configured in Google Cloud Console
- Check for trailing slashes and protocol (http vs https)

### User Not Created

- Check backend logs for errors
- Verify Google profile includes an email address
- Ensure database connection is working

### Tokens Not Set

- Verify cookie settings are correct for your environment
- Check CORS configuration
- Ensure `credentials: 'include'` is set in frontend requests

## Migration from Password-Only Users

Existing users with passwords can:

1. Continue using password-based login
2. Optionally link their Google account by signing in with Google using the same email
3. After linking, use either method to sign in

The system maintains backward compatibility with existing password-based authentication.
