import prisma from "../lib/prisma";
// export const getAllUsers = async (req: any, res: Response) => {
//   try {
//     const { page = 1, limit = 10, search = "" } = req.query;
//     const skip = (page - 1) * limit;
//     const whereClause = search
//       ? {
//           OR: [
//             { name: { contains: search, mode: "insensitive" } },
//             { email: { contains: search, mode: "insensitive" } },
//           ],
//         }
//       : {};
//     const [users, total] = await Promise.all([
//       prisma.user.findMany({
//         where: whereClause,
//         select: {
//           id: true,
//           name: true,
//           email: true,
//           role: true,
//           verified: true,
//           createdAt: true,
//         },
//         skip: parseInt(skip),
//         take: parseInt(limit),
//         orderBy: { createdAt: "desc" },
//       }),
//       prisma.user.count({ where: whereClause }),
//     ]);
//     res.json({
//       success: true,
//       data: users,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Get all users error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };
export const getUserById = async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                role: true,
                verified: true,
                country: true,
                city: true,
                avatar: true,
                pushToken: true,
                createdAt: true,
                updatedAt: true,
                reviews: {
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        createdAt: true,
                        post: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                tickets: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error,
        });
    }
};
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Check permissions
        if (userRole !== "ADMIN" && userId !== id) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to update this user",
            });
        }
        // Remove sensitive fields
        delete updateData.password;
        delete updateData.role; // Only admins can change role
        delete updateData.id;
        // Convert phoneNumber to float if provided
        if (updateData.phoneNumber) {
            updateData.phoneNumber = parseFloat(updateData.phoneNumber);
        }
        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                role: true,
                verified: true,
                country: true,
                city: true,
                avatar: true,
                pushToken: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({
            success: true,
            message: "User updated successfully",
            data: updatedUser,
        });
    }
    catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error,
        });
    }
};
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        // Only admins can delete users
        if (userRole !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete users",
            });
        }
        await prisma.user.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: "User deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error,
        });
    }
};
