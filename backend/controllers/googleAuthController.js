
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client();

const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: 'Google ID token is required',
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        message: 'Invalid or unverified Google account',
      });
    }

    /*
     * IMPORTANT:
     * Integrate this verified identity with your EXISTING User model
     * and JWT-generation logic.
     *
     * Find or create the user using the verified Google identity.
     * Do not accept role, userId, or centreId from req.body.
     * Preserve existing roles; new public registrations should get
     * only your app's ordinary user role.
     *
     * Return the same response format as your existing
     * POST /api/auth/login endpoint.
     */

    return res.status(501).json({
      message:
        'Google token verified. Connect this controller to the existing User model and login JWT logic.',
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || '',
    });
  } catch (error) {
    console.error('Google authentication failed:', error.message);

    return res.status(401).json({
      message: 'Google authentication failed',
    });
  }
};

module.exports = { googleAuth };
