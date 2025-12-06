import { Router } from 'express';
import { crawlUrl, healthCheck } from '../controllers/crawler.controller';

const router = Router();

/**
 * POST /crawl
 * Crawls a URL and extracts contact information
 * Body: { url: string }
 */
router.post('/crawl', crawlUrl);

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', healthCheck);

export default router;
