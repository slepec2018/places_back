const fs = require('fs');

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');


const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');

const Place = require('../models/place');
const User = require('../models/user');

const getPlacesById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;

  try {
    place = await Place.findById(placeId);
  } catch (error) {
    const err = new HttpError('Something went wrong, could not find a place.', 500);
    return next(err);
  }

  if (!place || place.length === 0) {
    const err = new HttpError('Could not find a places for the provided id.', 404);
    return next(err);
  }
  
  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => { 
  const userId = req.params.uid;
  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (error) {
    const err = new HttpError('Fetching places failed, please try again later', 500);
    return next(err);
  }

  if (!places || places.length === 0) {
    // const err = new HttpError('Could not find a places for the provided user id.', 404);
    // return next(err);
    return res.json({places: [] });
  }
  
  res.json({places: places.map(place => place.toObject({ getters: true }))});
}

const createPlace = async (req, res, next) => { 
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new HttpError('Invalid inputs passed, please check your data.', 422);
    return next(err);
  }

  const { title, description, address } = req.body;

  let coordinates;
  try { 
    coordinates = await getCoordsForAddress(address);
  } catch (error) { 
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (error) {
    const err = new HttpError('Creating place failed, please try again.', 500);
    return next(err);
  }

  if (!user) {
    const err = new HttpError('Could not find user for provided id.', 404);
    return next(err);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });

    user.places.push(createdPlace);
    await user.save({ session: sess });

    await sess.commitTransaction();
  } catch (error) {
    const err = new HttpError('Creating place failed, please try again.', 500);
    return next(err);
  }
  
  res.status(201).json({place: createdPlace});
};

const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new HttpError('Invalid inputs passed, please check your data.', 422);
    return next(err);
  }
  
  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (error) { 
    const err = new HttpError('Something went wrong, could not update place.', 500);
    return next(err);
  }

  if (place.creator.toString() !== req.userData.userId) { 
    const err = new HttpError('You are not allowed to edit this place.', 401);
    return next(err);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (error) {
    const err = new HttpError('Something went wrong, could not update place.', 500);
    return next(err);
  }

  res.status(200).json({place: place.toObject({ getters: true })});
};

const deletePlace = async (req, res, next) => { 
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (error) {
    const err = new HttpError('Something went wrong, could not delete place.', 500);
    return next(err);
  }

  if (!place) {
    const err = new HttpError('Could not find place for this id.', 404);
    return next(err);
  }

  if (place.creator.id !== req.userData.userId) { 
    const err = new HttpError('You are not allowed to delete this place.', 403);
    return next(err);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({ _id: placeId }, { session: sess });

    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    
    await sess.commitTransaction();
  } catch (error) {
    const err = new HttpError('Something went wrong, could not delete place.', 500);
    return next(err);
  }

  fs.unlink(imagePath, err => { 
    console.log(err);
  });

  res.status(200).json({message: 'Deleted place.'});
};

exports.getPlacesById = getPlacesById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlace = deletePlace;