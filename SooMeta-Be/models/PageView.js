// models/PageView.js
import mongoose from "mongoose";

const pageViewSchema = new mongoose.Schema({
  // Session ID cho cả logged-in và anonymous users
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // User ID (null nếu là anonymous user)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null,
    index: true
  },

  // Page URL
  pagePath: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Thời điểm vào trang
  enteredAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },

  // Thời điểm rời khỏi trang (null nếu chưa rời)
  exitedAt: {
    type: Date,
    default: null
  },

  // Thời gian ở lại trang (milliseconds) - tính khi exitedAt được set
  timeOnPage: {
    type: Number,
    default: null
  },

  // Device & Browser Info
  userAgent: {
    type: String
  },

  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },

  browser: {
    type: String
  },

  os: {
    type: String
  },

  // Referrer (trang người dùng đến từ đâu)
  referrer: {
    type: String,
    default: null
  },

  // Screen resolution
  screenResolution: {
    type: String
  },

  // Location (có thể add sau nếu cần)
  ipAddress: {
    type: String
  },

  country: {
    type: String
  },

  city: {
    type: String
  }
}, {
  timestamps: true // Auto tạo createdAt và updatedAt
});

// Compound indexes để query hiệu quả
pageViewSchema.index({ sessionId: 1, enteredAt: -1 }); // Lấy history của session
pageViewSchema.index({ user: 1, enteredAt: -1 }); // Lấy history của user
pageViewSchema.index({ pagePath: 1, enteredAt: -1 }); // Stats theo page
pageViewSchema.index({ enteredAt: -1 }); // Sort theo thời gian

// Virtual để tính timeOnPage nếu chưa có
pageViewSchema.virtual('calculatedTimeOnPage').get(function() {
  if (this.timeOnPage !== null) {
    return this.timeOnPage;
  }
  if (this.exitedAt) {
    return this.exitedAt.getTime() - this.enteredAt.getTime();
  }
  // Nếu chưa exit, tính từ lúc enter đến hiện tại
  return Date.now() - this.enteredAt.getTime();
});

// Pre-save hook: tự động tính timeOnPage khi exitedAt được set
pageViewSchema.pre('save', function(next) {
  if (this.exitedAt && !this.timeOnPage) {
    this.timeOnPage = this.exitedAt.getTime() - this.enteredAt.getTime();
  }
  next();
});

export default mongoose.models.PageView || mongoose.model('PageView', pageViewSchema);
