import Joi from 'joi';
import { Listing } from '../models/Listing.js';

const createSchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().trim().allow('').optional(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other').default('other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn').default('used'),
  status: Joi.string().valid('active', 'sold', 'removed').default('active'),
  seller: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

const updateSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().trim().allow(''),
  price: Joi.number().min(0),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn'),
  status: Joi.string().valid('active', 'sold', 'removed'),
  seller: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
}).min(1);

function publicListing(listing) {
  let seller = null;

  if (listing?.seller) {
    if (typeof listing.seller === 'object' && listing.seller._id) {
      seller = {
        id: listing.seller._id.toString(),
        name: listing.seller.name,
        email: listing.seller.email
      };
    } else {
      seller = listing.seller.toString();
    }
  }

  return {
    id: listing._id.toString(),
    title: listing.title,
    description: listing.description,
    price: listing.price,
    category: listing.category,
    condition: listing.condition,
    status: listing.status,
    seller,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt
  };
}

// GET /api/listings
export async function getAllListings(req, res, next) {
  try {
    const includeRemoved = req.query.includeRemoved === 'true' || req.query.removed === 'true';
    const filter = includeRemoved ? {} : { status: { $ne: 'removed' } };

    const listings = await Listing.find(filter)
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({ listings: listings.map(publicListing) });
  } catch (err) { next(err); }
}

// GET /api/listings/:id
export async function getListing(req, res, next) {
  try {
    const includeRemoved = req.query.includeRemoved === 'true' || req.query.removed === 'true';
    const listing = await Listing.findById(req.params.id).populate('seller', 'name email');

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed' && !includeRemoved) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// POST /api/listings
export async function createListing(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.create(value);
    const populated = await Listing.findById(listing._id).populate('seller', 'name email');

    res.status(201).json({ listing: publicListing(populated) });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id
export async function updateListing(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('seller', 'name email');

    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    res.json({ listing: publicListing(listing) });
  } catch (err) { next(err); }
}

// DELETE /api/listings/:id
export async function deleteListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    listing.status = 'removed';
    await listing.save();

    const populated = await Listing.findById(listing._id).populate('seller', 'name email');
    res.json({
      message: 'Listing marked as removed',
      listing: publicListing(populated)
    });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id/sold
export async function markListingSold(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed') {
      return res.status(400).json({ message: 'Cannot mark a removed listing as sold' });
    }
    if (listing.status === 'sold') {
      return res.json({ message: 'Listing is already marked as sold', listing: publicListing(listing) });
    }

    listing.status = 'sold';
    await listing.save();

    const populated = await Listing.findById(listing._id).populate('seller', 'name email');
    res.json({
      message: 'Listing marked as sold',
      listing: publicListing(populated)
    });
  } catch (err) { next(err); }
}
