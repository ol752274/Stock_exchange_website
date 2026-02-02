import {serve} from 'inngest/next';
import {inngest} from '@/lib/inngest/client';
import { send } from 'process';
import { sendDailyNewsSummary, sendSignUpEmail } from '@/lib/inngest/functions';


export const {GET, POST,PUT} = serve({
    client : inngest,
    functions:[sendSignUpEmail,sendDailyNewsSummary],
});

