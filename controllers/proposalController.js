const Proposal = require('../models/proposal.model');
const University = require('../models/university.model');

const factoryController = require('./factoryController');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.createProposal = catchAsync(async (req, res, next) => {
  req.body.upvotes = 0;
  req.body.accepted = false;
  req.body.uploadBy = req.user._id;

  if (!req.body.university) {
    return next(new AppError('Please provite ID of the University', 400));
  }

  const proposal = await Proposal.create(req.body);

  await University.findByIdAndUpdate(req.body.university, {
    $push: { proposals: { $each: [proposal._id], $position: 0 } }
  });

  res.status(201).json({
    status: 'success',
    data: proposal
  });
});

exports.getProposal = factoryController.getOne(
  Proposal,
  { path: 'uploadBy' },
  { path: 'comments' }
);

exports.proposalUpvote = catchAsync(async (req, res, next) => {
  const proposalId = req.params.id;
  console.log(req.user.name);

  const isAlreadyUpvoted = await Proposal.findOne({
    _id: proposalId,
    upvotesBy: req.user._id
  });

  if (isAlreadyUpvoted) {
    return next(new AppError('Already Upvoted!', 200)); // Hack, to avoid Problems
  }

  const updatedDoc = await Proposal.findByIdAndUpdate(proposalId, {
    $inc: { upvotes: 1 },
    $push: { upvotesBy: req.user._id }
  });

  res.status(200).json({
    status: 'success',
    data: {
      proposal: updatedDoc
    }
  });
});

exports.acceptProposal = catchAsync(async (req, res, next) => {
  console.log(req.body);
  console.log('Accept Proposal');

  const proposalId = req.params.id;
  const { universityId } = req.body;

  if (!proposalId || !universityId) {
    return next(
      new AppError('Please provide corrent Proposal and University Id', 400)
    );
  }

  const university = await University.findOne({
    _id: universityId,
    admin: req.user._id,
    proposals: proposalId
  });

  if (!university) {
    return next(new AppError('No correct university found!', 403));
  }

  const updatedProposal = await Proposal.findByIdAndUpdate(proposalId, {
    accepted: true
  });

  res.status(200).json({
    status: 'success',
    data: { proposal: updatedProposal }
  });
});

exports.declineProposal = catchAsync(async (req, res, next) => {
  const { proposalId, universityId } = req.body;

  if (!proposalId || !universityId) {
    return next(
      new AppError('Please provide corrent Proposal and University Id', 400)
    );
  }

  const university = University.findOne({
    _id: universityId,
    admin: req.user._id,
    proposals: proposalId
  });

  if (!university) {
    return next(new AppError('No correct university found!', 403));
  }

  const updatedProposal = Proposal.findByIdAndUpdate(proposalId, {
    accepted: false
  });

  res.status(200).json({
    status: 'success',
    data: { proposal: updatedProposal }
  });
});

exports.allProposals = factoryController.getAll(Proposal);
