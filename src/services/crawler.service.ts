import puppeteer from "puppeteer";

// Interface for extracted contact data
export interface CrawledContactData {
  title?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  department?: string;
  email?: string;
  phoneNumber?: string;
  mobile?: string;
  website?: string;
  address?: string;
  streetName?: string;
  city?: string;
  country?: string;
  uniqueCode?: string;
}

/**
 * Delay utility for retry logic
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Extracts email from text using regex
 */
const extractEmail = (text: string): string | undefined => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0] : undefined;
};

/**
 * Extracts phone number from text using regex
 */
const extractPhone = (text: string): string | undefined => {
  const phonePatterns = [
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,5}/,
    /(\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4})/,
    /\+?\d{10,15}/,
    /(\(\d{3}\)\s?\d{3}[-.\s]\d{4})/,
    /(\d{3}[-.\s]\d{3}[-.\s]\d{4})/,
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[0].replace(/[^\d+\-\s()]/g, '').trim();
      const digitCount = cleaned.replace(/[^\d]/g, '').length;
      if (digitCount >= 7 && digitCount <= 15) {
        return cleaned;
      }
    }
  }
  return undefined;
};

/**
 * Extracts unique code (9-15 alphanumeric characters) from text
 */
const extractUniqueCode = (text: string): string | undefined => {
  const keyValuePatterns = [
    /(?:code|uniquecode|unique_code|entrycode|entry_code|uniqueid|unique_id)\s*[=:]\s*([A-Za-z0-9]{9,15})/i,
    /NOTE\s*:\s*(?:code|uniquecode|unique_code)\s*[=:]\s*([A-Za-z0-9]{9,15})/i,
  ];

  for (const pattern of keyValuePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  const standalonePattern = /\b([A-Za-z0-9]{9,15})\b/g;
  const matches = text.match(standalonePattern);

  if (matches) {
    for (const match of matches) {
      const digitCount = match.replace(/[^\d]/g, '').length;
      if (digitCount > 10) continue;
      if (/^\d+$/.test(match)) continue;
      const context = text.substring(Math.max(0, text.indexOf(match) - 10), text.indexOf(match) + match.length + 10);
      if (context.includes('@') || context.includes('http') || context.includes('www')) continue;
      return match;
    }
  }

  return undefined;
};

/**
 * Validates if text is a valid name
 */
const isValidName = (text: string): boolean => {
  if (!text || text.length < 2 || text.length > 100) {
    return false;
  }

  const namePattern = /^[A-Za-z]+([\s\-'][A-Za-z]+)*$/;
  if (!namePattern.test(text)) {
    return false;
  }

  const invalidTerms = /(download|phone|email|address|website|contact|card|call|directions|mobile|office|home)/i;
  if (invalidTerms.test(text)) {
    return false;
  }

  return true;
};

/**
 * Validates if text is a valid company name
 */
const isValidCompany = (text: string): boolean => {
  if (!text || text.length < 2 || text.length > 100) {
    return false;
  }

  if (text.includes('@')) {
    return false;
  }

  if (/^\+?\d/.test(text)) {
    return false;
  }

  const jobTitles = /(director|manager|ceo|cto|cfo|engineer|developer|designer|download|phone|email)/i;
  if (jobTitles.test(text)) {
    return false;
  }

  return true;
};

/**
 * Validates if text is a valid position/job title
 */
const isValidPosition = (text: string): boolean => {
  if (!text || text.length < 2 || text.length > 100) {
    return false;
  }

  const positionKeywords = [
    'manager', 'director', 'engineer', 'developer', 'designer', 'analyst',
    'specialist', 'coordinator', 'officer', 'executive', 'president',
    'vice', 'assistant', 'associate', 'senior', 'junior', 'lead',
    'head', 'chief', 'ceo', 'cto', 'cfo', 'coo', 'consultant'
  ];

  const textLower = text.toLowerCase();
  return positionKeywords.some(keyword => textLower.includes(keyword));
};

/**
 * Parses QRCodeChimp payload
 */
const parseQRCodeChimpPayload = (rawScript: string, fallbackUrl: string): CrawledContactData | null => {
  if (!rawScript) {
    return null;
  }

  try {
    const payload = JSON.parse(rawScript);
    const content = Array.isArray(payload?.content) ? payload.content : [];
    const contactData: CrawledContactData = {};

    const ensureWebsite = (): string | undefined => {
      if (payload?.short_url) {
        const shortUrl: string = payload.short_url;
        if (shortUrl.startsWith('http')) {
          return shortUrl;
        }
        return `https://linko.page/${shortUrl}`;
      }
      return fallbackUrl;
    };

    const setIfEmpty = (key: keyof CrawledContactData, value?: string): void => {
      if (!value) return;
      if (!contactData[key]) {
        contactData[key] = value;
      }
    };

    const profileComponent = content.find((item: any) => item?.component === 'profile');
    if (profileComponent?.name) {
      const nameParts = String(profileComponent.name).trim().split(/\s+/);
      setIfEmpty('firstName', nameParts[0]);
      if (nameParts.length > 1) {
        setIfEmpty('lastName', nameParts.slice(1).join(' '));
      }
    }

    setIfEmpty('company', profileComponent?.company);
    setIfEmpty('position', profileComponent?.desc);

    if (Array.isArray(profileComponent?.contact_shortcuts)) {
      for (const shortcut of profileComponent.contact_shortcuts) {
        if (shortcut?.type === 'mobile') {
          setIfEmpty('phoneNumber', shortcut.value);
        }
        if (shortcut?.type === 'email') {
          setIfEmpty('email', shortcut.value);
        }
      }
    }

    const contactComponent = content.find((item: any) => item?.component === 'contact');
    if (Array.isArray(contactComponent?.contact_infos)) {
      for (const info of contactComponent.contact_infos) {
        if (info?.type === 'email') {
          setIfEmpty('email', info.email);
        }
        if (info?.type === 'number' || info?.type === 'mobile') {
          setIfEmpty('phoneNumber', info.number ?? info.value);
        }
        if (info?.type === 'address') {
          const street = info.street ?? info.address;
          const city = info.city ?? info.town;
          const country = info.country;
          setIfEmpty('address', street);
          setIfEmpty('city', city);
          setIfEmpty('country', country);
        }
      }
    }

    setIfEmpty('website', ensureWebsite());

    const hasData = Object.values(contactData).some((value) => Boolean(value));
    return hasData ? contactData : null;
  } catch (error: any) {
    console.error('Failed to parse embedded QR template payload:', error?.message || error);
    return null;
  }
};

/**
 * Scrapes contact information from a webpage
 */
export const scrapeWebpage = async (url: string, retryAttempts: number = 3): Promise<CrawledContactData> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt + 1}/${retryAttempts} - Scraping: ${url}`);

      console.log("🔧 Launching Puppeteer browser");
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
      await page.setViewport({ width: 1280, height: 720 });

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log(`📄 Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log("📊 Extracting data from rendered page...");

      // @ts-ignore - Code inside evaluate runs in browser context with DOM access
      const extractedData = await page.evaluate(() => {
        const getText = (selectors: string[]): string => {
          for (const selector of selectors) {
            // @ts-ignore
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim();
              if (text && text.length > 0) return text;
            }
          }
          return '';
        };

        const getMeta = (names: string[]): string => {
          for (const name of names) {
            // @ts-ignore
            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            if (meta) {
              const content = meta.getAttribute('content');
              if (content) return content.trim();
            }
          }
          return '';
        };

        const data: any = {};
        // @ts-ignore
        data.fullText = document.body.innerText;

        // @ts-ignore
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent || '');
            if (jsonData['@type'] === 'Person') {
              data.jsonLd = jsonData;
            }
          } catch (e) {
            // Ignore
          }
        }

        data.metaTitle = getMeta(['title', 'og:title', 'twitter:title']);
        data.metaDescription = getMeta(['description', 'og:description', 'twitter:description']);

        data.name = getText([
          '[itemprop="name"]',
          '.name', '.full-name', '.person-name',
          'h1.name', 'h2.name', 'h1', 'h2'
        ]);

        data.email = getText([
          '[itemprop="email"]',
          'a[href^="mailto:"]',
          '.email', '.e-mail',
          '[data-email]'
        ]);

        // @ts-ignore
        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink && !data.email) {
          const href = emailLink.getAttribute('href');
          if (href) {
            data.email = href.replace('mailto:', '').split('?')[0];
          }
        }

        data.phone = getText([
          '[itemprop="telephone"]',
          'a[href^="tel:"]',
          '.phone', '.tel', '.telephone', '.mobile',
          '[data-phone]'
        ]);

        // @ts-ignore
        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink && !data.phone) {
          const href = phoneLink.getAttribute('href');
          if (href) {
            data.phone = href.replace('tel:', '').trim();
          }
        }

        data.company = getText([
          '[itemprop="worksFor"]',
          '[itemprop="organization"]',
          '.company', '.organization', '.org'
        ]);

        data.position = getText([
          '[itemprop="jobTitle"]',
          '.title', '.job-title', '.position', '.role'
        ]);

        data.address = getText([
          '[itemprop="address"]',
          '[itemprop="streetAddress"]',
          '.address', '.street-address'
        ]);

        data.city = getText([
          '[itemprop="addressLocality"]',
          '.city', '.locality'
        ]);

        data.country = getText([
          '[itemprop="addressCountry"]',
          '.country'
        ]);

        try {
          // @ts-ignore
          const scripts = Array.from(document.scripts || []) as Array<any>;
          for (const script of scripts) {
            const text = script.textContent || '';
            if (text.includes('__savedQrCodeParams')) {
              const match = text.match(/__savedQrCodeParams\s*=\s*(\{[\s\S]*?\});?/);
              if (match && match[1]) {
                data.qrCodeChimpRaw = match[1];
                break;
              }
            }
          }
        } catch (err) {
          // Ignore
        }

        return data;
      });

      await browser.close();

      console.log("✅ Data extraction complete, processing...");
      console.log("📦 Extracted data:", JSON.stringify(extractedData, null, 2));

      const contactData: CrawledContactData = { website: url };
      const mergeIfMissing = (source?: CrawledContactData | null) => {
        if (!source) return;
        (Object.keys(source) as (keyof CrawledContactData)[]).forEach((key) => {
          const value = source[key];
          if (value && !contactData[key]) {
            contactData[key] = value;
          }
        });
      };

      if (extractedData.jsonLd) {
        const jld = extractedData.jsonLd;
        if (jld.name) {
          const nameParts = jld.name.split(' ');
          contactData.firstName = nameParts[0];
          if (nameParts.length > 1) {
            contactData.lastName = nameParts.slice(1).join(' ');
          }
        }
        if (jld.givenName) contactData.firstName = jld.givenName;
        if (jld.familyName) contactData.lastName = jld.familyName;
        if (jld.email) contactData.email = jld.email;
        if (jld.telephone) contactData.phoneNumber = jld.telephone;
        if (jld.jobTitle) contactData.position = jld.jobTitle;
        if (jld.worksFor?.name) contactData.company = jld.worksFor.name;
      }

      if (extractedData.name && !contactData.firstName) {
        const nameParts = extractedData.name.split(' ');
        contactData.firstName = nameParts[0];
        if (nameParts.length > 1) {
          contactData.lastName = nameParts.slice(1).join(' ');
        }
      }

      if (extractedData.email) {
        contactData.email = extractEmail(extractedData.email) || extractedData.email;
      }

      if (extractedData.phone) {
        contactData.phoneNumber = extractPhone(extractedData.phone) || extractedData.phone;
      }

      if (extractedData.company) {
        contactData.company = extractedData.company;
      }

      if (extractedData.position) {
        contactData.position = extractedData.position;
      }

      if (extractedData.address) {
        contactData.address = extractedData.address;
      }

      if (extractedData.city) {
        contactData.city = extractedData.city;
      }

      if (extractedData.country) {
        contactData.country = extractedData.country;
      }

      if (extractedData.qrCodeChimpRaw) {
        console.log('🧩 Embedded QR template payload detected, parsing as fallback...');
        mergeIfMissing(parseQRCodeChimpPayload(extractedData.qrCodeChimpRaw, url));
      }

      const normalizedPageText = extractedData.fullText?.toLowerCase();
      if (normalizedPageText && normalizedPageText.includes('just a moment') && normalizedPageText.includes('checking if the site connection is secure')) {
        console.warn('⚠️ Possible bot challenge detected on page content.');
      }

      if (!contactData.email && !contactData.phoneNumber && extractedData.fullText) {
        console.log("🔄 Applying fallback text extraction...");
        const lines = extractedData.fullText.split("\n").filter((line: string) => line.trim());

        contactData.email = extractEmail(extractedData.fullText);
        contactData.phoneNumber = extractPhone(extractedData.fullText);

        if (!contactData.firstName && lines.length > 0) {
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (
              trimmedLine.length >= 3 &&
              trimmedLine.length < 50 &&
              !trimmedLine.includes("@") &&
              !trimmedLine.match(/\d{3}/) &&
              isValidName(trimmedLine)
            ) {
              const nameParts = trimmedLine.split(" ");
              if (nameParts.length >= 2) {
                contactData.firstName = nameParts[0];
                contactData.lastName = nameParts.slice(1).join(" ");
              } else {
                contactData.firstName = trimmedLine;
              }
              break;
            }
          }
        }

        if (!contactData.company && lines.length > 1) {
          for (let i = 1; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();
            if (line.length > 2 && line.length < 100 && isValidCompany(line)) {
              contactData.company = line;
              break;
            }
          }
        }

        if (!contactData.position && lines.length > 1) {
          for (let i = 1; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();
            if (line.length > 2 && line.length < 100 && isValidPosition(line)) {
              contactData.position = line;
              break;
            }
          }
        }
      }

      console.log("✨ Final contact data:", JSON.stringify(contactData, null, 2));
      return contactData;

    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`❌ Error on attempt ${attempt + 1}:`, error.message);
      console.error(`Stack trace:`, error.stack);

      if (attempt < retryAttempts - 1) {
        const delayMs = 1000 * Math.pow(2, attempt);
        console.log(`⏳ Retry attempt ${attempt + 2}/${retryAttempts} after ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }

  console.error("❌ Error scraping webpage after", retryAttempts, "attempts:", lastError?.message);
  console.error("Full error:", lastError);
  return { website: url };
};
