# Deployment Guide

## Quick Deployment Options

### 1. Deploy to Render (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**One-click deployment:**
1. Click the deploy button above
2. Connect your GitHub account
3. Fork this repository to your account
4. Configure service settings:
   - **Name**: `webtextextract`
   - **Environment**: `Python 3.11`
   - **Build Command**: Will be auto-configured
   - **Start Command**: Will be auto-configured
5. Deploy automatically

**Manual Render deployment:**
1. Fork this repository
2. Create a new Web Service on Render
3. Connect your forked repository
4. Use these settings:
   - **Runtime**: Python 3.11.8
   - **Build Command**: `pip install flask gunicorn trafilatura requests urllib3 lxml psycopg2-binary flask-sqlalchemy email-validator`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT main:app`
   - **Environment Variables**:
     - `SESSION_SECRET`: Generate automatically or set your own

### 2. Deploy to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main
```

### 3. Deploy to Railway

1. Visit [Railway.app](https://railway.app)
2. Create new project from GitHub repository
3. Connect your forked repository
4. Set environment variables in Railway dashboard:
   - `SESSION_SECRET`: Generate a secure secret
5. Deploy automatically

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add SESSION_SECRET
```

### 5. Deploy to PythonAnywhere

1. Upload project files to PythonAnywhere
2. Create a new web app with Python 3.11
3. Install dependencies: `pip install -r requirements.txt`
4. Configure WSGI file to point to `main:app`
5. Set environment variables in web app settings

### 6. Deploy to DigitalOcean App Platform

1. Create new app on DigitalOcean
2. Connect GitHub repository
3. Configure app spec:
   ```yaml
   name: webtextextract
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/webtextextract
       branch: main
     run_command: gunicorn --bind 0.0.0.0:$PORT main:app
     environment_slug: python
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: SESSION_SECRET
       scope: RUN_TIME
       type: SECRET
   ```

## Environment Variables

### Required
- `SESSION_SECRET`: Secret key for Flask sessions (auto-generated on most platforms)

### Optional
- `PORT`: Server port (auto-configured on most platforms)
- `PYTHON_VERSION`: Python version (3.11.8 recommended)

## Post-Deployment Setup

1. **Test the application**:
   - Visit your deployed URL
   - Try extracting content from a webnovel URL
   - Test navigation between chapters

2. **Configure custom domain** (optional):
   - Most platforms offer custom domain configuration
   - Follow platform-specific documentation

3. **Monitor performance**:
   - Check logs for any errors
   - Monitor response times
   - Set up uptime monitoring if needed

## Troubleshooting

### Common Issues

**Build failures:**
- Check Python version compatibility
- Verify all dependencies in requirements.txt
- Check build logs for specific error messages

**Runtime errors:**
- Ensure SESSION_SECRET is set
- Check that main:app is accessible
- Verify port binding configuration

**Content extraction issues:**
- Some sites may block requests from certain IP ranges
- Consider implementing request headers or user agents
- Check if target sites have anti-scraping measures

### Performance Optimization

**For production use:**
- Use multiple workers: `--workers 2`
- Set appropriate timeouts: `--timeout 120`
- Enable request logging for monitoring
- Consider implementing caching for frequently accessed content

### Security Considerations

- Always use HTTPS in production
- Set strong SESSION_SECRET values
- Consider rate limiting for heavy usage
- Monitor for abuse and implement appropriate restrictions

## Platform-Specific Notes

### Render
- Automatic HTTPS
- Free tier includes 750 hours/month
- Automatic deployments from GitHub
- Built-in monitoring and logs

### Heroku
- Free tier discontinued (paid plans only)
- Excellent add-on ecosystem
- Automatic scaling options
- Built-in CI/CD pipeline

### Railway
- Modern deployment platform
- Generous free tier
- Simple GitHub integration
- Real-time logs and metrics

### Vercel
- Optimized for static sites and serverless
- May require configuration for Flask apps
- Excellent CDN and edge network
- Built-in analytics

## Support

If you encounter deployment issues:
1. Check the platform's documentation
2. Review application logs
3. Create an issue on GitHub with:
   - Platform used
   - Error messages
   - Deployment configuration
   - Steps to reproduce

## Contributing

Found ways to improve deployment? Please contribute:
1. Test your changes on multiple platforms
2. Update this documentation
3. Submit a pull request with clear description