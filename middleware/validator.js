const joi = require('joi');



// Validation schema using Joi
const blogValidator = joi.object({
    category: joi.string().min(2).max(100).required(),
    title: joi.string().min(5).max(200).required(),
    description: joi.string().min(10).max(5000).required()
});

// Validate incoming text fields if present (we allow partial updates)
const allowedUpdateSchema = joi.object({
    category: joi.string().min(2).max(100),
    title: joi.string().min(5).max(200),
    description: joi.string().min(10).max(5000)
}).min(1); // at least one field required

// subscription validator
const subscriberMail = joi.object({
    email: joi.string().min(6).max(60).email({
        tlds: { allow: ['com', 'net'] }
    }).required(),
})

// message validator
const messageValidator = joi.object({
    name: joi.string().required().messages({
        "string.empty": "Please provide your name",
        "any.required": "Name is required"
    }),
    email: joi.string()
        .min(6)
        .max(60)
        .email({ tlds: { allow: ["com", "net"] } })
        .required()
        .messages({
            "string.empty": "Please provide your email",
            "string.email": "Please provide a valid email address",
            "any.required": "Email is required"
        }),
    phone: joi.number().required().messages({
        "number.empty": "Please provide your contact number",
        "any.required": "Number is required"
    }),
    message: joi.string().required().messages({
        "string.empty": "Please provide your message",
        "any.required": "Message is required"
    }),
});

// review validator

const reviewValidator = joi.object({
    name: joi.string().required().messages({
        "string.empty": "Please provide your name",
        "any.required": "Name is required"
    }),
    email: joi.string().min(6).max(60).email({
        tlds: { allow: ['com', 'net'] }
    }).required(),
    content: joi.string().required().messages({
        "string.empty": "Please provide your message",
        "any.required": "Message is required"
    }),
    rating: joi.number().required().messages({
        "number.empty": "Please choose rating number",
        "any.required": "Position is required"
    })
})
// staff validator
const staffValidator = joi.object({
    position: joi.string().min(2).max(100),
    title: joi.string().min(5).max(200),
    bio: joi.string().min(5).max(500)
})

// product Validator
const productValidator = joi.object({
    category: joi.string().min(2).max(100),
    price: joi.number().min(0).max(10000),
    name: joi.string().min(2).max(200),
    status: joi.string().min(2).max(200),
    size: joi.string().min(2).max(200),
    description: joi.string().min(10).max(500)
}).min(1); // at least one field required

// Order validator

const orderValidator = joi.object({
    customerInfo: joi.object({
        name: joi.string().min(2).required(),
        phone: joi.string().min(8).required(),
        email: joi.string().email().optional(),
        address: joi.string().allow("").optional(),
        deliveryType: joi.string().valid("pickup", "delivery").default("pickup"),
        // ✅ Accept any string for paymentMethod
        paymentMethod: joi.string().optional().default("cash"),
    }).required(),

    items: joi.array().items(
        joi.object({
            productId: joi.string().required(),
            name: joi.string().required(),
            price: joi.number().positive().required(),
            quantity: joi.number().integer().positive().required(),
            totalPrice: joi.number().positive().required(),
            images: joi.array().items(joi.string().uri()).optional(),
            category: joi.string().optional(),
        })
    ).min(1).required(),

    // Paystack/Payment fields (optional)
    paymentStatus: joi.string().valid('pending', 'paid', 'failed', 'refunded').optional(),
    paymentReference: joi.string().optional(),
    paidAt: joi.date().optional(),
    paymentGateway: joi.string().optional(),
    paymentDetails: joi.object().optional()
});

module.exports = { orderValidator, staffValidator, subscriberMail, productValidator, messageValidator, reviewValidator, blogValidator, allowedUpdateSchema }