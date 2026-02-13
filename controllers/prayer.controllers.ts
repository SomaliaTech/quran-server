// controllers/prayerTimeController.js

import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createOrUpdatePrayerTime = async (req: Request, res: Response) => {
  try {
    const { fajr, dhuhr, asr, maghrib, isha } = req.body;

    // Validate that all times are provided
    if (!fajr || !dhuhr || !asr || !maghrib || !isha) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all prayer times (fajr, dhuhr, asr, maghrib, isha)",
      });
    }

    // We use 'upsert' or 'updateMany' to ensure we only ever have ONE active config.
    // Here we find the first record and update it, or create it if missing.
    const settings = await prisma.prayerTime.findFirst();

    let prayerTime;

    if (settings) {
      // If a record exists, update the "Forever" settings
      prayerTime = await prisma.prayerTime.update({
        where: { id: settings.id },
        data: { fajr, dhuhr, asr, maghrib, isha },
      });
    } else {
      // If no record exists, create the first one
      prayerTime = await prisma.prayerTime.create({
        data: {
          fajr,
          dhuhr,
          asr,
          maghrib,
          isha,
          isActive: true,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Prayer times updated for everyone forever",
      data: prayerTime,
    });
  } catch (error) {
    console.error("Prayer Time Update Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPrayerTimes = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 30, startDate, endDate, hijriDate } = req.query;

    const skip = (page - 1) * limit;

    const whereClause = {
      ...(startDate &&
        endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(hijriDate && { hijriDate }),
    };

    const [prayerTimes, total] = await Promise.all([
      prisma.prayerTime.findMany({
        where: whereClause,

        skip: Number(skip),
        take: parseInt(limit),
      }),
      prisma.prayerTime.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: prayerTimes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get prayer times error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error,
    });
  }
};

// export const getTodayPrayerTime = async (req: Request, res: Response) => {
//   try {
//     // We don't care about the date anymore.
//     // We just get the current active settings.
//     const prayerTime = await prisma.prayerTime.findFirst({
//       where: { isActive: true },
//       orderBy: { updatedAt: "desc" }, // Gets the most recent update
//     });

//     if (!prayerTime) {
//       return res.status(404).json({ message: "No prayer times configured" });
//     }

//     res.json({ success: true, data: prayerTime });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// Helper function to get current prayer based on time
// export const getCurrentPrayer = async (req: Request, res: Response) => {
//   const prayerTime = await prisma.prayerTime.findFirst({
//     where: { isActive: true },
//   });
//   if (prayerTime) {
//     const now = new Date();
//     // Format current time as "HH:mm" (e.g., "14:30")
//     const currentTime =
//       now.getHours().toString().padStart(2, "0") +
//       ":" +
//       now.getMinutes().toString().padStart(2, "0");

//     const times = [
//       { name: "Fajr", time: prayerTime.fajr },
//       { name: "Dhuhr", time: prayerTime.dhuhr },
//       { name: "Asr", time: prayerTime.asr },
//       { name: "Maghrib", time: prayerTime.maghrib },
//       { name: "Isha", time: prayerTime.isha },
//     ];

//     // Logic: The current prayer is the LAST one in the array that is <= currentTime
//     let current = times[times.length - 1].name; // Default to Isha (from previous day)
//     for (let i = 0; i < times.length; i++) {
//       if (currentTime >= times[i].time) {
//         current = times[i].name;
//       }
//     }

//     // Find next prayer
//     const next = times.find((t) => t.time > currentTime) || times[0];

//     res.json({ currentPrayer: current, nextPrayer: next.name });
//   }
// };
// Helper function to get current prayer based on time

export const getCurrentPrayer = async (req: Request, res: Response) => {
  try {
    // Current time in minutes
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Get today's active prayer time
    const prayerTime = await prisma.prayerTime.findFirst({
      where: { isActive: true },
    });

    if (!prayerTime) {
      return res.status(404).json({
        success: false,
        message: "No prayer time found for today",
      });
    }

    // Convert "7:20pm" → minutes since midnight
    const timeToMinutes = (timeStr: string): number => {
      const match = timeStr.match(/(\d+):(\d+)(am|pm)/i);

      if (!match) {
        throw new Error(`Invalid time format: ${timeStr}`);
      }

      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const period = match[3].toLowerCase();

      if (period === "pm" && hours !== 12) {
        hours += 12;
      }

      if (period === "am" && hours === 12) {
        hours = 0;
      }

      return hours * 60 + minutes;
    };

    // Prayer times in minutes
    const prayerTimes = [
      { name: "Fajr", time: timeToMinutes(prayerTime.fajr) },
      { name: "Dhuhr", time: timeToMinutes(prayerTime.dhuhr) },
      { name: "Asr", time: timeToMinutes(prayerTime.asr) },
      { name: "Maghrib", time: timeToMinutes(prayerTime.maghrib) },
      { name: "Isha", time: timeToMinutes(prayerTime.isha) },
    ];

    // Find current prayer (last passed)
    let currentPrayer = prayerTimes[0].name;

    for (let i = prayerTimes.length - 1; i >= 0; i--) {
      if (currentTime >= prayerTimes[i].time) {
        currentPrayer = prayerTimes[i].name;
        break;
      }
    }

    // Find next prayer
    const nextPrayer = prayerTimes.find((prayer) => currentTime < prayer.time);

    const minutesUntilNext = nextPrayer
      ? nextPrayer.time - currentTime
      : 1440 - currentTime + prayerTimes[0].time; // until next day's Fajr

    return res.json({
      success: true,
      data: {
        currentPrayer,
        nextPrayer: nextPrayer ? nextPrayer.name : prayerTimes[0].name,
        minutesUntilNext,
        today: prayerTime,
      },
    });
  } catch (error) {
    console.error("Get current prayer error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
