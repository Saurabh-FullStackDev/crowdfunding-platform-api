const multer = require('multer');
const sharp = require('sharp');

const University = require('../models/university.model');
const User = require('../models/user.model');

const factoryController = require('./factoryController');
const AppError = require('./../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

// MIDDLEWARES
exports.uploadUniversityImage = upload.fields([{ name: 'image', maxCount: 1 }]);

exports.resizeUniversityImage = catchAsync(async (req, res, next) => {
  if (!req.files) {
    return next();
  }

  if (!req.files.image) return next();

  // 1) Cover image
  req.body.image = `university-${Date.now()}-cover.jpeg`;

  await sharp(req.files.image[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 100 })
    .toFile(`public/images/university/${req.body.image}`);
  next();
});

exports.getuniversity = factoryController.getOne(
  University,
  { path: 'proposals' },
  { path: 'members' }
);

exports.inviteMember = catchAsync(async (req, res, next) => {
  const { userEmail } = req.body;
  const universityId = req.params.id;

  const updated = await University.findByIdAndUpdate(universityId, {
    $push: { invites: userEmail }
  });

  if (!updated) {
    return next(new AppError('No University found by that Id', 400));
  }

  const url = `${req.protocol}://${req.get(
    'host'
  )}/v1/api/university/${universityId}/invite`;

  console.log(url);
  await new Email('', url, userEmail).inviteMemberinUniversity(
    updated.name,
    userEmail
  );

  res.status(200).json({
    status: 'success',
    data: {
      message: 'Email send!'
    }
  });
});

exports.redeemInvitation = catchAsync(async (req, res, next) => {
  const universityId = req.params.id;
  const userEmail = req.user.email;

  const university = await University.findById(universityId);

  if (!university || !university.invites.includes(userEmail)) {
    return next(
      new AppError('Seems like you are not invited by that University!', 403)
    );
  }

  await User.findOneAndUpdate(
    { email: userEmail },
    { university: universityId }
  );

  const updatedUniversity = await University.findByIdAndUpdate(universityId, {
    $push: { members: req.user._id },
    $pull: { invites: req.user.email }
  });

  res.status(200).json({
    status: 'success',
    data: {
      university: updatedUniversity
    }
  });
});

exports.myUniversity = catchAsync(async (req, res, next) => {
  const myUniversity = await University.findOne({
    members: req.user._id
  })
    .populate({ path: 'members' })
    .populate({ path: 'proposals' });

  if (!myUniversity) {
    return next(new AppError('You are not a member of any university!', 200)); // To avoid Problems
  }

  res.status(200).json({
    status: 'success',
    data: {
      university: myUniversity
    }
  });
});

exports.createUniversity = catchAsync(async (req, res, next) => {
  req.body.admin = req.user._id;

  const doc = await University.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      data: doc
    }
  });
});

exports.getAlluniversities = factoryController.getAll(University);
