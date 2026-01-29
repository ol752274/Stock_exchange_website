import { inngest } from '@/lib/inngest/client';
import { NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT } from './prompts';

import { sendNewsSummaryEmail, sendWelcomeEmail } from '../nodemailer';
import { getAllUserForNewsEmail } from '../actions/user.actions';
import { getWatchlistSymbolsByEmail } from '../actions/watchlist.actions';
import { getNews, type NewsArticle } from '../actions/finnhub.actions';
import { formatDateToday } from '../utils';

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created' },
    async ({ event, step }) => {
        const userProfile = `
            - Country : ${event.data.country}
            - Investment goals : ${event.data.investmentGoals}
            - Risk tolerance : ${event.data.riskTolerance}
            - Preferred industry : ${event.data.preferredIndustry} 
        `;
        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile);
        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            }
        });
        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText =
                (part && 'text' in part ? part.text : null) ||
                'Welcome to StockSense! We are thrilled to have you on board.';
            const { data: { email, name } } = event;
            return await sendWelcomeEmail({ email, name, intro: introText });
        });
        return {
            success: true,
            message: 'Welcome email sent successfully'
        };
    }
);

interface UserNewsData {
    id: string;
    email: string;
    name: string;
}

interface NewsItem {
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: string;
}

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [{ event: 'app/send.daily.news' }, { cron: '0 12 * * *' }],
    async ({ step }) => {
        // Step 1: Get all users for news delivery
        const users = await step.run('get-all-users', async () => {
            return await getAllUserForNewsEmail();
        });

        if (!users || users.length === 0) {
            return { success: false, message: 'No users found for news email' };
        }

        // Step 2: For each user, get their watchlist symbols and fetch news
        const userNewsMapObject = await step.run('fetch-personalized-news', async () => {
            const map: Record<string, NewsItem[]> = {};

            for (const user of users as UserNewsData[]) {
                try {
                    // Get watchlist symbols for this user
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    console.log(`Fetching news for ${user.email} with symbols:`, symbols);

                    // Fetch news (personalized if symbols exist, general otherwise)
                    const articles: NewsArticle[] = await getNews(symbols.length > 0 ? symbols : undefined);
                    console.log(`Retrieved ${articles.length} articles for ${user.email}`);

                    // Take max 6 articles
                    map[user.email] = articles.slice(0, 6).map((article: NewsArticle) => ({
                        headline: article.headline,
                        summary: article.summary,
                        source: article.source,
                        url: article.url,
                        datetime: article.datetime.toISOString(),
                    }));
                } catch (e) {
                    console.error(`Error fetching news for user ${user.email}:`, e);
                    map[user.email] = [];
                }
            }

            console.log('Final userNewsMapObject:', JSON.stringify(map));
            return map;
        });

        // Step 3: Summarize news via AI
        const userNewsSummaries: { user: UserNewsData; newsContent: string | null }[] = [];
        for (const user of users as UserNewsData[]) {
            try {
                const articles = userNewsMapObject[user.email] || [];
                console.log(`Creating prompt for ${user.email} with articles:`, articles);
                const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));
                
                const response = await step.ai.infer(`summarize-news-${user.email}`,
                    {
                        model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                        body: {
                            contents: [{ role: 'user', parts: [{ text: prompt }] }]
                        }
                    }
                );
                console.log(`AI Response for ${user.email}:`, response);
                
                const part = response.candidates?.[0].content?.parts?.[0];
                const newsContent = (part && 'text' in part ? part.text : null) || '<p>No market news available today.</p>';
                console.log(`News content for ${user.email}:`, newsContent);
                
                userNewsSummaries.push({ user, newsContent });
            } catch (e) {
                console.error('Failed to summarize news for:', user.email, e);
                userNewsSummaries.push({ user, newsContent: '<p>Unable to fetch market news at this time. Please try again later.</p>' });
            }
        }

        // Step 4: Send emails
        await step.run('send-news-emails', async () => {
            const results = await Promise.all(
                userNewsSummaries.map(async ({ user, newsContent }) => {
                    if (!newsContent) {
                        console.log(`Skipping email for ${user.email} - no news content`);
                        return false;
                    }
                    console.log(`Sending email to ${user.email}`);
                    return await sendNewsSummaryEmail({ email: user.email, date: formatDateToday, newsContent });
                })
            );
            console.log('Email sending results:', results);
            return results;
        });

        return { success: true,message : 'Daily News Summary email sent successfully' };
    }
);