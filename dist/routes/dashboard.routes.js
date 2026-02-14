// routes/dashboard.routes.ts
import { Router } from "express";
import { startOfDay, endOfDay, subDays, format, } from "date-fns";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
const router = Router();
// ============ COLOR CONSTANTS ============
const CATEGORY_COLORS = [
    "#2D5A27", // Dark Green
    "#27AE60", // Green
    "#F39C12", // Orange
    "#3498DB", // Blue
    "#9B59B6", // Purple
    "#E74C3C", // Red
    "#1ABC9C", // Turquoise
    "#E67E22", // Carrot
    "#95A5A6", // Gray
    "#34495E", // Navy
];
const STATUS_COLORS = {
    LOST: "#E74C3C",
    FOUND: "#27AE60",
    PENDING: "#F39C12",
    RESOLVED: "#3498DB",
    REJECTED: "#95A5A6",
};
// ============ MAIN DASHBOARD ROUTE ============
router.get("/stats", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        // Get date ranges
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const weekAgo = subDays(now, 7);
        const monthAgo = subDays(now, 30);
        // Run all queries in parallel for better performance
        const [
        // Overview stats
        totalPosts, lostItems, foundItems, resolvedItems, activeTickets, totalUsers, pendingReviews, userPosts, 
        // Daily trends
        postsToday, postsYesterday, resolvedToday, resolvedYesterday, 
        // Weekly activity
        weeklyActivity, 
        // Category distribution
        categoryStats, 
        // Status breakdown
        statusStats, 
        // Recent activity
        recentActivity, 
        // Popular posts
        popularPosts, 
        // Active users (admin only)
        activeUsers, 
        // Recent tickets
        recentTickets,] = await Promise.all([
            // Overview queries
            prisma.post.count(),
            prisma.post.count({ where: { status: "lost", isMissing: true } }),
            prisma.post.count({ where: { status: "found", isMissing: false } }),
            prisma.post.count({ where: { status: "resolved" } }),
            prisma.ticket.count({
                where: { status: { notIn: ["CLOSED", "RESOLVED"] } },
            }),
            prisma.user.count(),
            prisma.review.count({ where: { replies: { none: {} } } }),
            // User-specific posts count
            prisma.post.count({ where: { userId } }),
            // Daily trends
            prisma.post.count({
                where: {
                    createdAt: { gte: todayStart, lte: todayEnd },
                },
            }),
            prisma.post.count({
                where: {
                    createdAt: {
                        gte: startOfDay(subDays(now, 1)),
                        lte: endOfDay(subDays(now, 1)),
                    },
                },
            }),
            prisma.post.count({
                where: {
                    status: "resolved",
                    updatedAt: { gte: todayStart, lte: todayEnd },
                },
            }),
            prisma.post.count({
                where: {
                    status: "resolved",
                    updatedAt: {
                        gte: startOfDay(subDays(now, 1)),
                        lte: endOfDay(subDays(now, 1)),
                    },
                },
            }),
            // Weekly activity (last 7 days)
            Promise.all(Array.from({ length: 7 }, (_, i) => {
                const day = subDays(now, 6 - i);
                return Promise.all([
                    prisma.post.count({
                        where: {
                            createdAt: {
                                gte: startOfDay(day),
                                lte: endOfDay(day),
                            },
                        },
                    }),
                    prisma.post.count({
                        where: {
                            status: "resolved",
                            updatedAt: {
                                gte: startOfDay(day),
                                lte: endOfDay(day),
                            },
                        },
                    }),
                ]).then(([posts, resolved]) => ({
                    day: format(day, "EEE"),
                    posts,
                    resolved,
                }));
            })),
            // Category distribution
            prisma.post.groupBy({
                by: ["categories"],
                _count: true,
                where: {
                    categories: { isEmpty: false },
                },
            }),
            // Status breakdown
            prisma.post.groupBy({
                by: ["status"],
                _count: true,
            }),
            // Recent activity (combined feed)
            Promise.all([
                // Recent posts
                prisma.post.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: {
                        user: { select: { name: true, avatar: true } },
                    },
                }),
                // Recent tickets
                prisma.ticket.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: {
                        user: { select: { name: true } },
                        post: { select: { name: true } },
                    },
                }),
                // Recent reviews
                prisma.review.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: {
                        user: { select: { name: true, avatar: true } },
                        post: { select: { name: true } },
                    },
                }),
            ]).then(([recentPosts, recentTickets, recentReviews]) => {
                const activities = [];
                recentPosts.forEach((post) => ({
                    id: post.id,
                    type: "post",
                    title: post.name,
                    time: formatDistanceToNow(post.createdAt, { addSuffix: true }),
                    status: post.status,
                    user: post.user.name,
                }));
                recentTickets.forEach((ticket) => ({
                    id: ticket.id,
                    type: "ticket",
                    title: ticket.title,
                    time: formatDistanceToNow(ticket.createdAt, { addSuffix: true }),
                    status: ticket.status,
                    user: ticket.user.name,
                }));
                recentReviews.forEach((review) => ({
                    id: review.id,
                    type: "review",
                    title: `Review on ${review.post.name}`,
                    time: formatDistanceToNow(review.createdAt, { addSuffix: true }),
                    user: review.user.name,
                }));
                return activities
                    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                    .slice(0, 10);
            }),
            // Popular posts
            prisma.post.findMany({
                take: 5,
                orderBy: [{ purchased: "desc" }, { reviews: { _count: "desc" } }],
                select: {
                    id: true,
                    name: true,
                    status: true,
                    thumbnail: true,
                    purchased: true,
                    reviews: {
                        select: { rating: true },
                    },
                    _count: {
                        select: { reviews: true, tickets: true },
                    },
                },
            }),
            // Active users (admin only)
            userRole === "ADMIN"
                ? prisma.user.findMany({
                    take: 5,
                    orderBy: {
                        post: { _count: "desc" },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        _count: {
                            select: {
                                post: true,
                                reviews: true,
                            },
                        },
                    },
                })
                : Promise.resolve([]),
            // Recent tickets
            prisma.ticket.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                where: userRole !== "ADMIN" ? { creatorId: userId } : {},
                include: {
                    user: { select: { name: true, email: true } },
                    post: { select: { name: true, thumbnail: true } },
                    _count: {
                        select: { replies: true },
                    },
                },
            }),
        ]);
        // Calculate trends
        const postsTrend = postsYesterday > 0
            ? ((postsToday - postsYesterday) / postsYesterday) * 100
            : postsToday > 0
                ? 100
                : 0;
        const resolvedTrend = resolvedYesterday > 0
            ? ((resolvedToday - resolvedYesterday) / resolvedYesterday) * 100
            : resolvedToday > 0
                ? 100
                : 0;
        // Process category distribution
        const categoryDistribution = categoryStats
            .filter((stat) => stat.categories && stat.categories.length > 0)
            .slice(0, 8)
            .map((stat, index) => ({
            name: Array.isArray(stat.categories)
                ? stat.categories[0]
                : stat.categories,
            count: stat._count,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }));
        // Process status breakdown
        const statusBreakdown = statusStats.map((stat) => ({
            status: stat.status || "unknown",
            count: stat._count,
            color: STATUS_COLORS[stat.status] || "#95A5A6",
        }));
        // Build dashboard response
        const dashboardStats = {
            overview: {
                totalPosts,
                lostItems,
                foundItems,
                resolvedItems,
                activeTickets,
                totalUsers,
                pendingReviews,
            },
            trends: {
                daily: Math.round(postsTrend * 10) / 10,
                weekly: 12.5, // You can calculate this from weekly data
                monthly: 8.3, // You can calculate this from monthly data
            },
            charts: {
                weeklyActivity,
                categoryDistribution,
                statusBreakdown,
                recentActivity,
            },
            topItems: {
                popularPosts: popularPosts.map((post) => ({
                    id: post.id,
                    title: post.name,
                    views: post.purchased || 0,
                    engagements: post._count.reviews + post._count.tickets,
                    status: post.status,
                    // thumbnail: post.thumbnail.url,
                })),
                activeUsers: activeUsers.map((user) => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    // avatar: user.avatar?.url,
                    posts: user._count.post,
                    resolutions: user._count.reviews,
                })),
                recentTickets: recentTickets.map((ticket) => ({
                    id: ticket.id,
                    title: ticket.title,
                    status: ticket.status,
                    priority: determinePriority(ticket),
                    createdAt: ticket.createdAt,
                    user: ticket.user.name,
                    postTitle: ticket.post.name,
                    replies: ticket._count.replies,
                })),
            },
        };
        // Add user-specific stats
        const userStats = {
            myPosts: userPosts,
            myActiveTickets: recentTickets.length,
            pendingActions: await prisma.ticket.count({
                where: {
                    post: { userId },
                    status: "PENDING",
                },
            }),
        };
        res.status(200).json({
            success: true,
            data: {
                ...dashboardStats,
                user: userStats,
            },
        });
    }
    catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// ============ USER DASHBOARD ROUTE ============
router.get("/user/:userId", authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUser = req.user;
        // Check permissions
        if (requestingUser.role !== "ADMIN" && requestingUser.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to view this user's dashboard",
            });
        }
        const [userPosts, userTickets, userReviews, userActivity] = await Promise.all([
            // User's posts with stats
            prisma.post.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: { reviews: true, tickets: true },
                    },
                    reviews: {
                        take: 3,
                        orderBy: { createdAt: "desc" },
                        select: {
                            rating: true,
                            comment: true,
                            user: { select: { name: true } },
                        },
                    },
                },
            }),
            // User's tickets
            prisma.ticket.findMany({
                where: { creatorId: userId },
                orderBy: { createdAt: "desc" },
                include: {
                    post: { select: { name: true, thumbnail: true } },
                    _count: { select: { replies: true } },
                },
            }),
            // User's reviews
            prisma.review.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                include: {
                    post: { select: { name: true, thumbnail: true } },
                },
            }),
            // User's activity timeline
            prisma.$transaction([
                prisma.post.findMany({
                    where: { userId },
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    select: { id: true, name: true, createdAt: true, status: true },
                }),
                prisma.ticket.findMany({
                    where: { creatorId: userId },
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    select: { id: true, title: true, createdAt: true, status: true },
                }),
                prisma.review.findMany({
                    where: { userId },
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        comment: true,
                        createdAt: true,
                        rating: true,
                    },
                }),
            ]),
        ]);
        const [recentPosts, recentTickets, recentReviews] = userActivity;
        // Calculate user stats
        const totalViews = userPosts.reduce((sum, post) => sum + (post.purchased || 0), 0);
        const averageRating = userReviews.length > 0
            ? userReviews.reduce((sum, review) => sum + review.rating, 0) /
                userReviews.length
            : 0;
        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalPosts: userPosts.length,
                    totalTickets: userTickets.length,
                    totalReviews: userReviews.length,
                    totalViews,
                    averageRating: Math.round(averageRating * 10) / 10,
                    resolutionRate: calculateResolutionRate(userTickets),
                },
                posts: userPosts,
                tickets: userTickets,
                reviews: userReviews,
                activity: {
                    posts: recentPosts,
                    tickets: recentTickets,
                    reviews: recentReviews,
                },
            },
        });
    }
    catch (error) {
        console.error("User dashboard error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user dashboard",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// ============ POST ANALYTICS ROUTE ============
// ============ ADMIN DASHBOARD ROUTE ============
router.get("/admin/overview", authenticate, async (req, res) => {
    try {
        //   if (req.user.role !== "ADMIN") {
        //     return res.status(403).json({
        //       success: false,
        //       message: "Admin access required",
        //     });
        //   }
        const [userGrowth, postGrowth, ticketStats, topContributors, systemHealth,] = await Promise.all([
            // User growth (last 30 days)
            prisma.user.groupBy({
                by: ["createdAt"],
                _count: true,
                where: {
                    createdAt: { gte: subDays(new Date(), 30) },
                },
            }),
            // Post growth (last 30 days)
            prisma.post.groupBy({
                by: ["createdAt"],
                _count: true,
                where: {
                    createdAt: { gte: subDays(new Date(), 30) },
                },
            }),
            // Ticket statistics
            prisma.ticket.groupBy({
                by: ["status"],
                _count: true,
            }),
            // Top contributors
            prisma.user.findMany({
                take: 10,
                orderBy: {
                    post: { _count: "desc" },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                    _count: {
                        select: {
                            post: true,
                            reviews: true,
                            tickets: true,
                        },
                    },
                },
            }),
            // System health metrics
            Promise.resolve({
                activeUsers: await prisma.user.count({
                    where: {
                        updatedAt: { gte: subDays(new Date(), 1) },
                    },
                }),
                postsToday: await prisma.post.count({
                    where: {
                        createdAt: { gte: startOfDay(new Date()) },
                    },
                }),
                ticketsOpen: await prisma.ticket.count({
                    where: { status: "PENDING" },
                }),
            }),
        ]);
        res.status(200).json({
            success: true,
            data: {
                growth: {
                    users: userGrowth,
                    posts: postGrowth,
                },
                tickets: ticketStats,
                contributors: topContributors,
                health: systemHealth,
            },
        });
    }
    catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin dashboard",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// ============ HELPER FUNCTIONS ============
function determinePriority(ticket) {
    // Implement your priority logic here
    const age = Date.now() - new Date(ticket.createdAt).getTime();
    const days = age / (1000 * 60 * 60 * 24);
    if (days > 7)
        return "URGENT";
    if (days > 3)
        return "HIGH";
    if (days > 1)
        return "MEDIUM";
    return "LOW";
}
function calculateResolutionRate(tickets) {
    if (tickets.length === 0)
        return 0;
    const resolved = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return Math.round((resolved / tickets.length) * 100);
}
function calculateResponseRate(tickets) {
    if (tickets.length === 0)
        return 100;
    const responded = tickets.filter((t) => t._count.replies > 0).length;
    return Math.round((responded / tickets.length) * 100);
}
function formatDistanceToNow(date, options) {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60)
        return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}
// routes/activity.routes.ts
// ============ GET RECENT ACTIVITY FEED ============
router.get("/activity/recent", authenticate, async (req, res) => {
    try {
        // Get recent posts, reviews, and tickets in one combined feed
        const [recentPosts, recentTickets, recentReviews] = await Promise.all([
            // Recent posts (last 10)
            prisma.post.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    isMissing: true,
                    categories: true,
                    thumbnail: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            }),
            // Recent tickets (last 5)
            prisma.ticket.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    post: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            // Recent reviews (last 5)
            prisma.review.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    post: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
        ]);
        // Format and combine all activities
        const activities = [
            ...recentPosts.map((post) => ({
                id: post.id,
                type: "post",
                title: post.name,
                description: post.isMissing ? "Lost item" : "Found item",
                status: post.status || (post.isMissing ? "lost" : "found"),
                category: post.categories[0] || "Uncategorized",
                time: formatTimeAgo(post.createdAt),
                user: {
                    id: post.user.id,
                    name: post.user.name,
                    avatar: post.user.avatar,
                },
                // thumbnail: post.thumbnail?.url,
                icon: post.isMissing ? "alert-circle" : "checkmark-circle",
                iconColor: post.isMissing ? "#E74C3C" : "#27AE60",
            })),
            ...recentTickets.map((ticket) => ({
                id: ticket.id,
                type: "ticket",
                title: ticket.title,
                description: `Support ticket - ${ticket.post?.name || "Item"}`,
                status: ticket.status,
                time: formatTimeAgo(ticket.createdAt),
                user: {
                    id: ticket.user.id,
                    name: ticket.user.name,
                    avatar: ticket.user.avatar,
                },
                icon: "help-buoy",
                iconColor: "#F39C12",
            })),
            ...recentReviews.map((review) => ({
                id: review.id,
                type: "review",
                title: `Review on ${review.post?.name || "item"}`,
                description: review.comment?.substring(0, 50) +
                    (review.comment?.length > 50 ? "..." : ""),
                rating: review.rating,
                time: formatTimeAgo(review.createdAt),
                user: {
                    id: review.user.id,
                    name: review.user.name,
                    avatar: review.user.avatar,
                },
                icon: "star",
                iconColor: "#F1C40F",
            })),
        ];
        // Sort by time (newest first) and limit to 20 items
        const sortedActivities = activities
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 20);
        res.status(200).json({
            success: true,
            data: sortedActivities,
        });
    }
    catch (error) {
        console.error("Recent activity error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch recent activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// ============ GET USER SPECIFIC ACTIVITY ============
router.get("/activity/user/:userId", authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUser = req.user;
        // Check permissions
        if (requestingUser.role !== "ADMIN" && requestingUser.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to view this user's activity",
            });
        }
        const [userPosts, userTickets, userReviews] = await Promise.all([
            prisma.post.findMany({
                where: { userId },
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    isMissing: true,
                    createdAt: true,
                    thumbnail: true,
                },
            }),
            prisma.ticket.findMany({
                where: { creatorId: userId },
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                    post: {
                        select: { name: true },
                    },
                },
            }),
            prisma.review.findMany({
                where: { userId },
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    post: {
                        select: { name: true },
                    },
                },
            }),
        ]);
        res.status(200).json({
            success: true,
            data: {
                posts: userPosts,
                tickets: userTickets,
                reviews: userReviews,
            },
        });
    }
    catch (error) {
        console.error("User activity error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// ============ HELPER FUNCTION ============
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diffInSeconds < 60)
        return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
}
export default router;
