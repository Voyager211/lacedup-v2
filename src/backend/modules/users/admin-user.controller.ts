import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import type { IUser } from './user.types';
import User from './user.model';
import { getPagination } from '../../common/utils/pagination.util';




// AJAX rendering
const apiUsers = async (req: Request, res: Response) => {
    try {
        const q = req.query.q || '';
        const status = req.query.status || 'all'; // all, blocked, unblocked
        const page = parseInt(String(req.query.page)) || 1;
        const limit = 10;

        // Build query with role filter
        const query: FilterQuery<IUser> = { role: 'user' };
        
        // Add search filter
        if (q) {
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }
        
        // Add blocking status filter
        if (status === 'blocked') {
            query.isBlocked = true;
        } else if (status === 'unblocked') {
            query.isBlocked = false;
        }
        // 'all' - no isBlocked filter added
        
        const { data: users, totalPages } = await getPagination(
            User.find(query).sort({ createdAt: -1 }),
            User,
            query,
            page,
            limit
        );

        res.json({ users, currentPage: page, totalPages, statusFilter: status });
    } catch (err: any) {
        console.error('Error fetching user data: ', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


// AJAX blocking & unblocking
const apiBlockUser = async (req: Request, res: Response) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            isBlocked: true,
            blockedAt: new Date()
        });
        res.json({ success: true });
    } catch (err: any) {
        console.error('Error blocking user:', err);
        res.status(500).json({ success: false, message: 'Error blocking user' });
    }
};


const apiUnblockUser = async (req: Request, res: Response) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            isBlocked: false,
            blockedAt: null
        });
        res.json({ success: true });
    } catch (err: any) {
        console.error('Error unblocking user:', err);
        res.status(500).json({ success: false, message: 'Error unblocking user' });
    }
};


export {
    apiUsers,
    apiBlockUser,
    apiUnblockUser
};
