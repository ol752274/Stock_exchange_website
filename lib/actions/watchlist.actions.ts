'use server'
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist, type WatchlistItem } from '@/database/models/watchlist.model';

export const getWatchlistSymbolsByEmail = async (email: string): Promise<string[]> => {
    try {
        await connectToDatabase();
        
        // Get user from MongoDB by email
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Database connection failed');
        
        const user = await db.collection('user').findOne(
            { email },
            { projection: { id: 1, _id: 1 } }
        );
        
        if (!user) {
            return [];
        }
        
        const userId = user.id || user._id?.toString() || '';
        
        // Get all watchlist items for this user
        const watchlistItems = await Watchlist.find(
            { userId },
            { symbol: 1 }
        ).lean();
        
        return watchlistItems.map(item => item.symbol);
    } catch (e) {
        console.error('Error fetching watchlist symbols by email:', e);
        return [];
    }
};

export const addToWatchlist = async (
    userId: string,
    symbol: string,
    company: string
): Promise<WatchlistItem | null> => {
    try {
        await connectToDatabase();
        
        const watchlistItem = await Watchlist.create({
            userId,
            symbol: symbol.toUpperCase(),
            company,
            addedAt: new Date()
        });
        
        return watchlistItem;
    } catch (e) {
        console.error('Error adding to watchlist:', e);
        return null;
    }
};

export const removeFromWatchlist = async (
    userId: string,
    symbol: string
): Promise<boolean> => {
    try {
        await connectToDatabase();
        
        const result = await Watchlist.deleteOne({
            userId,
            symbol: symbol.toUpperCase()
        });
        
        return result.deletedCount > 0;
    } catch (e) {
        console.error('Error removing from watchlist:', e);
        return false;
    }
};

export const getUserWatchlist = async (userId: string): Promise<WatchlistItem[]> => {
    try {
        await connectToDatabase();
        
        const watchlist = await Watchlist.find({ userId }).sort({ addedAt: -1 });
        
        return watchlist;
    } catch (e) {
        console.error('Error fetching watchlist:', e);
        return [];
    }
};

export const getWatchlistItem = async (
    userId: string,
    symbol: string
): Promise<WatchlistItem | null> => {
    try {
        await connectToDatabase();
        
        const item = await Watchlist.findOne({
            userId,
            symbol: symbol.toUpperCase()
        });
        
        return item;
    } catch (e) {
        console.error('Error fetching watchlist item:', e);
        return null;
    }
};

export const clearUserWatchlist = async (userId: string): Promise<boolean> => {
    try {
        await connectToDatabase();
        
        const result = await Watchlist.deleteMany({ userId });
        
        return result.deletedCount > 0;
    } catch (e) {
        console.error('Error clearing watchlist:', e);
        return false;
    }
};