import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { cloudinary } from "../main";

// controllers/postController.js

// Ensure you have the correct import for Cloudinary

export const createPost = async (req: any, res: Response) => {
  try {
    const {
      name,
      description,
      categories,
      contact,
      status,
      thumbnail,
      tags,
      location,
      isMissing = true,
      visibility = true,
    } = req.body;

    const userId = req.user.id;

    if (
      !name ||
      !description ||
      !categories ||
      !contact ||
      !thumbnail ||
      !tags ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    let uploadedThumbnail;
    if (thumbnail && thumbnail.url) {
      const upload = await cloudinary.uploader.upload(thumbnail.url, {
        folder: "images",
      });

      uploadedThumbnail = {
        public_id: upload.public_id,
        url: upload.secure_url,
      };
    }

    const post = await prisma.post.create({
      data: {
        name,
        description,
        categories,
        contect: {
          create: {
            phone: contact.phone,
            email: contact.email,
          },
        },
        isMissing,
        thumbnail: uploadedThumbnail! || null, // Set thumbnail if it exists
        tags,
        status,
        location: {
          create: {
            name: location.name,
            address: location.address,
            coordinates: location.coordinates,
          },
        },
        visibility,
        userId, // Ensure Post model has userId field
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post,
    });
  } catch (error: any) {
    console.error("Create post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error?.message || error,
    });
  }
};

export const getAllPosts = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "", isMissing } = req.query;

    const skip = (page - 1) * limit;
    //cloudinary here
    const whereClause = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          // FIX: Search inside the location relation fields
          {
            location: {
              is: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { address: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }),
      ...(isMissing !== undefined && { isMissing: isMissing === "true" }),
      // ... rest of your filters
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        include: {
          location: {
            select: {
              address: true,
              name: true,
            },
          },
          contect: {
            select: {
              phone: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              tickets: true,
            },
          },
        },
        skip: Number(skip),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    // Calculate average ratings
    const postsWithStats = posts.map((post) => ({
      ...post,
      averageRating:
        post.reviews.length > 0
          ? post.reviews.reduce((sum, review) => sum + review.rating, 0) /
            post.reviews.length
          : 0,
    }));

    res.json({
      success: true,
      data: postsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all posts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error,
    });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            country: true,
            city: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        tickets: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error("Get post by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const updatePost = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if post exists and user owns it (or is admin)
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (userRole !== "ADMIN" && post.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this post",
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.ratings;

    const updatedPost = await prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Post updated successfully",
      data: updatedPost,
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const deletePost = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if post exists and user owns it (or is admin)
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (userRole !== "ADMIN" && post.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this post",
      });
    }

    // Delete related data first (reviews, tickets, etc.)
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { postId: id } }),
      prisma.ticket.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
