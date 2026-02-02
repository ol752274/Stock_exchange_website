'use server'
import { cache } from 'react';
import { getDateRange } from '@/lib/utils';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

interface FinnhubArticle {
    id: number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    image: string;
    category: string;
    datetime: number;
    related: string;
}

export interface NewsArticle {
    id: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    image: string;
    datetime: Date;
    symbol?: string;
}

interface FinnhubSearchResult {
    symbol: string;
    description: string;
    displaySymbol: string;
    type: string;
    exchange: string;
}

interface FinnhubSearchResponse {
    result?: FinnhubSearchResult[];
}

interface FinnhubStockProfile {
    symbol: string;
    name: string;
    exchange: string;
    [key: string]: unknown;
}

export interface StockWithWatchlistStatus {
    symbol: string;
    name: string;
    description?: string;
    exchange?: string;
    type?: string;
    displaySymbol?: string;
}

async function fetchJSON<T>(
    url: string,
    revalidateSeconds?: number
): Promise<T> {
    const options: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (revalidateSeconds !== undefined) {
        options.cache = 'force-cache';
        options.next = { revalidate: revalidateSeconds };
    } else {
        options.cache = 'no-store';
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

function validateArticle(article: unknown): article is FinnhubArticle {
    if (typeof article !== 'object' || article === null) return false;
    
    const a = article as Record<string, unknown>;
    return (
        typeof a.headline === 'string' &&
        typeof a.summary === 'string' &&
        typeof a.source === 'string' &&
        typeof a.url === 'string' &&
        typeof a.datetime === 'number'
    );
}

function formatArticle(article: FinnhubArticle, symbol?: string): NewsArticle {
    return {
        id: `${article.id}`,
        headline: article.headline,
        summary: article.summary,
        source: article.source,
        url: article.url,
        image: article.image || '',
        datetime: new Date(article.datetime * 1000),
        ...(symbol && { symbol }),
    };
}

export const getNews = async (symbols?: string[]): Promise<NewsArticle[]> => {
    try {
        if (!FINNHUB_API_KEY) {
            throw new Error('FINNHUB_API_KEY is not set');
        }

        const { from, to } = getDateRange(5);
        const articles: NewsArticle[] = [];
        const seenIds = new Set<string>();

        if (symbols && symbols.length > 0) {
            // Clean and uppercase symbols
            const cleanSymbols = symbols
                .map(s => s.trim().toUpperCase())
                .filter(s => s.length > 0);

            if (cleanSymbols.length === 0) {
                return getGeneralNews();
            }

            // Round-robin through symbols, max 6 articles total
            let roundCount = 0;
            const maxRounds = 6;

            while (articles.length < 6 && roundCount < maxRounds) {
                for (const symbol of cleanSymbols) {
                    if (articles.length >= 6) break;

                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
                        const data = await fetchJSON<unknown[]>(url, 3600);

                        if (Array.isArray(data)) {
                            for (const item of data) {
                                if (articles.length >= 6) break;

                                if (validateArticle(item)) {
                                    const articleId = `${item.id}`;
                                    if (!seenIds.has(articleId)) {
                                        seenIds.add(articleId);
                                        articles.push(formatArticle(item, symbol));
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`Error fetching news for symbol ${symbol}:`, e);
                        continue;
                    }
                }

                roundCount++;
            }

            return articles.sort(
                (a, b) => b.datetime.getTime() - a.datetime.getTime()
            );
        } else {
            return getGeneralNews();
        }
    } catch (e) {
        console.error('Error fetching news:', e);
        throw new Error('Failed to fetch news');
    }
};

async function getGeneralNews(): Promise<NewsArticle[]> {
    try {
        if (!FINNHUB_API_KEY) {
            throw new Error('FINNHUB_API_KEY is not set');
        }

        const { from, to } = getDateRange(5);
        const url = `${FINNHUB_BASE_URL}/news?category=general&minId=0&token=${FINNHUB_API_KEY}`;

        const data = await fetchJSON<unknown[]>(url, 3600);

        if (!Array.isArray(data)) {
            return [];
        }

        const seenKeys = new Set<string>();
        const articles: NewsArticle[] = [];

        for (const item of data) {
            if (articles.length >= 6) break;

            if (validateArticle(item)) {
                // Deduplicate by id, url, and headline
                const key = `${item.id}-${item.url}-${item.headline}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    articles.push(formatArticle(item));
                }
            }
        }

        return articles.sort(
            (a, b) => b.datetime.getTime() - a.datetime.getTime()
        );
    } catch (e) {
        console.error('Error fetching general news:', e);
        return [];
    }
}

const POPULAR_STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'PYPL', 'INTC'];

export const searchStocks = cache(async (query?: string): Promise<StockWithWatchlistStatus[]> => {
    try {
        if (!FINNHUB_API_KEY) {
            throw new Error('FINNHUB_API_KEY is not set');
        }

        let results: FinnhubSearchResult[] = [];

        if (!query || query.trim().length === 0) {
            // Fetch top 10 popular stocks using stock/profile2
            const profiles: FinnhubSearchResult[] = [];

            for (const symbol of POPULAR_STOCK_SYMBOLS.slice(0, 10)) {
                try {
                    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
                    const profile = await fetchJSON<FinnhubStockProfile>(url, 3600);

                    if (profile && profile.symbol) {
                        profiles.push({
                            symbol: profile.symbol,
                            description: profile.name || profile.symbol,
                            displaySymbol: profile.symbol,
                            type: 'Common Stock',
                            exchange: profile.exchange || 'US',
                        });
                    }
                } catch (e) {
                    console.error(`Error fetching profile for ${symbol}:`, e);
                    continue;
                }
            }

            results = profiles;
        } else {
            // Search for stocks by query
            try {
                const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query.trim())}&token=${FINNHUB_API_KEY}`;
                const response = await fetchJSON<FinnhubSearchResponse>(url, 1800);

                if (response.result && Array.isArray(response.result)) {
                    results = response.result;
                }
            } catch (e) {
                console.error(`Error searching for stocks with query "${query}":`, e);
                return [];
            }
        }

        // Map results to StockWithWatchlistStatus
        const stocks: StockWithWatchlistStatus[] = results.map((result) => ({
            symbol: result.symbol.toUpperCase(),
            name: result.description,
            description: result.description,
            exchange: result.exchange,
            type: result.type,
            displaySymbol: result.displaySymbol,
        }));

        return stocks;
    } catch (e) {
        console.error('Error in searchStocks:', e);
        return [];
    }
});