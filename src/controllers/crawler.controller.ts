import { Request, Response } from 'express';
import { scrapeWebpage, CrawledContactData } from '../services/crawler.service';

/**
 * Controller for crawling URLs and extracting contact information
 */
export const crawlUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL is required and must be a string',
      });
      return;
    }

    // Validate URL format
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        res.status(400).json({
          success: false,
          error: 'Invalid URL protocol. Only http and https are supported',
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
      return;
    }

    console.log(`📥 Received crawl request for URL: ${url}`);

    // Perform web scraping
    const contactData: CrawledContactData = await scrapeWebpage(url);

    // Return the scraped data
    res.status(200).json({
      success: true,
      data: contactData,
    });

  } catch (error: any) {
    console.error('❌ Error in crawlUrl controller:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while crawling URL',
    });
  }
};

/**
 * Health check endpoint
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: 'Crawler service is running',
    timestamp: new Date().toISOString(),
  });
};
