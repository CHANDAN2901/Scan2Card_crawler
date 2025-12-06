# Crawler Service

A dedicated microservice for web scraping and crawling QR code URLs to extract contact information.

## Features

- Web scraping using Puppeteer
- Optimized for Render deployment
- Contact data extraction from various webpage formats
- JSON-LD and meta tag parsing
- Rate limiting and security middleware
- Health check endpoint

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "success": true,
  "message": "Crawler service is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Crawl URL

```
POST /api/crawl
Content-Type: application/json

{
  "url": "https://example.com/contact"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Example Corp",
    "position": "CEO",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "website": "https://example.com",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA"
  }
}
```

## Usage with Main Backend

Update your main backend's `.env` file:

```env
CRAWLER_SERVICE_URL=http://localhost:3001
```

The main backend will make HTTP requests to this service when it detects a QR code with a URL.

## Deployment on Render

Render natively supports Puppeteer! Just:

1. Push your code to GitHub
2. Create a new Web Service on Render
3. Set the root directory to `CrawlerService`
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variables in Render dashboard
7. Render will automatically install Chromium dependencies

## License

ISC
