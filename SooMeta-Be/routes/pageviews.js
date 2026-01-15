// routes/pageviews.js
import express from 'express';
import PageView from '../models/PageView.js';
import authMiddleware from '../middleware/auth.js';
import UAParser from 'ua-parser-js';

const router = express.Router();

/**
 * POST /pageviews/track
 * Track page view - ghi lại khi user vào trang
 * Không require authentication để track cả anonymous users
 */
router.post('/track', async (req, res) => {
  try {
    const {
      sessionId,
      pagePath,
      referrer,
      screenResolution
    } = req.body;

    if (!sessionId || !pagePath) {
      return res.status(400).json({
        message: 'sessionId và pagePath là bắt buộc'
      });
    }

    // Parse user agent để lấy thông tin device
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Determine device type
    let deviceType = 'unknown';
    if (result.device.type === 'mobile') deviceType = 'mobile';
    else if (result.device.type === 'tablet') deviceType = 'tablet';
    else if (result.browser.name) deviceType = 'desktop';

    // Get IP address
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection.remoteAddress
      || req.socket.remoteAddress;

    // Create new page view
    const pageView = new PageView({
      sessionId,
      user: req.currentUser?.id || null, // null nếu không đăng nhập
      pagePath,
      enteredAt: new Date(),
      userAgent,
      deviceType,
      browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
      referrer: referrer || null,
      screenResolution: screenResolution || null,
      ipAddress: ipAddress || null
    });

    await pageView.save();

    res.status(200).json({
      message: 'Page view tracked',
      pageViewId: pageView._id
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
    res.status(500).json({
      message: 'Error tracking page view',
      details: error.message
    });
  }
});

/**
 * POST /pageviews/exit
 * Ghi lại khi user rời khỏi trang (update exitedAt)
 */
router.post('/exit', async (req, res) => {
  try {
    const { pageViewId } = req.body;

    if (!pageViewId) {
      return res.status(400).json({
        message: 'pageViewId là bắt buộc'
      });
    }

    const pageView = await PageView.findById(pageViewId);

    if (!pageView) {
      return res.status(404).json({
        message: 'Page view không tồn tại'
      });
    }

    // Update exitedAt nếu chưa có
    if (!pageView.exitedAt) {
      pageView.exitedAt = new Date();
      // timeOnPage sẽ tự động tính trong pre-save hook
      await pageView.save();
    }

    res.status(200).json({
      message: 'Page exit tracked',
      timeOnPage: pageView.timeOnPage
    });
  } catch (error) {
    console.error('Error tracking page exit:', error);
    res.status(500).json({
      message: 'Error tracking page exit',
      details: error.message
    });
  }
});

/**
 * POST /pageviews/heartbeat
 * Update last activity time để track active sessions
 * Gọi API này mỗi 30s để biết user vẫn còn trên trang
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { pageViewId } = req.body;

    if (!pageViewId) {
      return res.status(400).json({
        message: 'pageViewId là bắt buộc'
      });
    }

    const pageView = await PageView.findById(pageViewId);

    if (!pageView) {
      return res.status(404).json({
        message: 'Page view không tồn tại'
      });
    }

    // Update exitedAt to current time (như "still here" signal)
    pageView.exitedAt = new Date();
    await pageView.save();

    res.status(200).json({ message: 'Heartbeat received' });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({
      message: 'Error processing heartbeat',
      details: error.message
    });
  }
});

/**
 * GET /pageviews/stats
 * Lấy thống kê page views (admin only)
 */
router.get('/stats', authMiddleware, async (req, res) => {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    return res.status(403).json({
      message: 'Truy cập bị từ chối. Yêu cầu quyền admin.'
    });
  }

  try {
    const { startDate, endDate, pagePath, groupBy = 'day' } = req.query;

    // Build filter
    const filter = {};

    if (startDate || endDate) {
      filter.enteredAt = {};
      if (startDate) filter.enteredAt.$gte = new Date(startDate);
      if (endDate) filter.enteredAt.$lte = new Date(endDate);
    }

    if (pagePath) {
      filter.pagePath = pagePath;
    }

    // Aggregation pipeline
    let dateGroup;
    if (groupBy === 'hour') {
      dateGroup = {
        year: { $year: "$enteredAt" },
        month: { $month: "$enteredAt" },
        day: { $dayOfMonth: "$enteredAt" },
        hour: { $hour: "$enteredAt" }
      };
    } else if (groupBy === 'day') {
      dateGroup = {
        year: { $year: "$enteredAt" },
        month: { $month: "$enteredAt" },
        day: { $dayOfMonth: "$enteredAt" }
      };
    } else { // month
      dateGroup = {
        year: { $year: "$enteredAt" },
        month: { $month: "$enteredAt" }
      };
    }

    const stats = await PageView.aggregate([
      { $match: filter },
      {
        $group: {
          _id: dateGroup,
          totalViews: { $sum: 1 },
          uniqueSessions: { $addToSet: "$sessionId" },
          uniqueUsers: { $addToSet: "$user" },
          avgTimeOnPage: { $avg: "$timeOnPage" },
          totalTimeOnPage: { $sum: "$timeOnPage" },
          deviceTypes: { $push: "$deviceType" },
          browsers: { $push: "$browser" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalViews: 1,
          uniqueSessionsCount: { $size: "$uniqueSessions" },
          uniqueUsersCount: {
            $size: {
              $filter: {
                input: "$uniqueUsers",
                cond: { $ne: ["$$this", null] }
              }
            }
          },
          avgTimeOnPage: { $round: ["$avgTimeOnPage", 0] },
          totalTimeOnPage: 1,
          deviceTypes: 1,
          browsers: 1
        }
      },
      { $sort: { "date.year": 1, "date.month": 1, "date.day": 1, "date.hour": 1 } }
    ]);

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting page view stats:', error);
    res.status(500).json({
      message: 'Error getting stats',
      details: error.message
    });
  }
});

/**
 * GET /pageviews/popular-pages
 * Lấy danh sách trang được xem nhiều nhất (admin only)
 */
router.get('/popular-pages', authMiddleware, async (req, res) => {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    return res.status(403).json({
      message: 'Truy cập bị từ chối. Yêu cầu quyền admin.'
    });
  }

  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.enteredAt = {};
      if (startDate) filter.enteredAt.$gte = new Date(startDate);
      if (endDate) filter.enteredAt.$lte = new Date(endDate);
    }

    const popularPages = await PageView.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$pagePath",
          totalViews: { $sum: 1 },
          uniqueSessions: { $addToSet: "$sessionId" },
          avgTimeOnPage: { $avg: "$timeOnPage" }
        }
      },
      {
        $project: {
          _id: 0,
          pagePath: "$_id",
          totalViews: 1,
          uniqueSessionsCount: { $size: "$uniqueSessions" },
          avgTimeOnPage: { $round: ["$avgTimeOnPage", 0] }
        }
      },
      { $sort: { totalViews: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json(popularPages);
  } catch (error) {
    console.error('Error getting popular pages:', error);
    res.status(500).json({
      message: 'Error getting popular pages',
      details: error.message
    });
  }
});

/**
 * GET /pageviews/realtime
 * Lấy số người đang online hiện tại (admin only)
 * Định nghĩa "online" = có page view trong 5 phút gần đây
 */
router.get('/realtime', authMiddleware, async (req, res) => {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    return res.status(403).json({
      message: 'Truy cập bị từ chối. Yêu cầu quyền admin.'
    });
  }

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const online = await PageView.aggregate([
      {
        $match: {
          enteredAt: { $gte: fiveMinutesAgo }
        }
      },
      {
        $group: {
          _id: null,
          uniqueSessions: { $addToSet: "$sessionId" },
          uniqueUsers: { $addToSet: "$user" },
          activePages: { $push: { path: "$pagePath", session: "$sessionId" } }
        }
      },
      {
        $project: {
          _id: 0,
          totalSessions: { $size: "$uniqueSessions" },
          totalUsers: {
            $size: {
              $filter: {
                input: "$uniqueUsers",
                cond: { $ne: ["$$this", null] }
              }
            }
          },
          activePages: 1
        }
      }
    ]);

    res.status(200).json(online[0] || {
      totalSessions: 0,
      totalUsers: 0,
      activePages: []
    });
  } catch (error) {
    console.error('Error getting realtime stats:', error);
    res.status(500).json({
      message: 'Error getting realtime stats',
      details: error.message
    });
  }
});

export default router;
