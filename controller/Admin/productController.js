const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const multer = require('multer');
const path = require('path');



const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// const upload = multer({
//     storage: storage,
//     limits: { fileSize: 1000000 }, // 1 MB limit
//     fileFilter: (req, file, cb) => {
//         const filetypes = /jpeg|jpg|png|gif/;
//         const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//         const mimetype = filetypes.test(file.mimetype);

//         if (mimetype && extname) {
//             return cb(null, true);
//         } else {
//             cb('Error: Images Only!');
//         }
//     }
// }).array('productImage', 3); // Allow up to 3 images
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // 1 MB limit
    fileFilter: (req, file, cb) => {
        console.log('File type:', file.mimetype);
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            console.error('Invalid file type:', file.mimetype);
            cb(new Error('Error: Images Only!'), false);
        }
    }
}).array('productImage', 3);


exports.addProduct = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Error uploading files:', err);
            return res.redirect('/admin/product?error=Error uploading files');
        } else {
            try {
                const { productName, description, category, regularPrice, salePrice, productOffer, quantity } = req.body;

                if (!req.files || req.files.length === 0) {
                    return res.redirect('/admin/product?error=No images uploaded');
                }

                const productImages = req.files.map(file => '/uploads/' + file.filename);

                const newProduct = new Product({
                    productName,
                    description,
                    category,
                    regularPrice,
                    salePrice,
                    productOffer,
                    quantity,
                    productImage: productImages,
                    status: 'Active'
                });

                await newProduct.save();
                return res.redirect("/admin/product?success=Product added successfully");
            } catch (error) {
                console.error('Error adding product:', error);
                return res.redirect("/admin/product?error=Error adding product");
            }
        }
    });
};


// exports.editProduct = (req, res) => {
//     upload(req, res, async (err) => {
//         if (err) {
//             console.error('Error uploading files:', err);
//             return res.redirect('/admin/product?error=Error uploading files');
//         } else {
//             try {
//                 const { productName, description, category, regularPrice, salePrice, productOffer, quantity } = req.body;

//                 const productImages = req.files.length ? req.files.map(file => '/uploads/' + file.filename) : undefined;

//                 const product = await Product.findById(req.params.id);

//                 product.productName = productName;
//                 product.description = description;
//                 product.category = category;
//                 product.regularPrice = regularPrice;
//                 product.salePrice = salePrice;
//                 product.productOffer = productOffer;
//                 product.quantity = quantity;
//                 if (productImages) product.productImage.push(...productImages);

//                 await product.save();
//                 return res.redirect('/admin/product?success=Product updated successfully');
//             } catch (error) {
//                 console.error('Error editing product:', error);
//                 return res.redirect('/admin/product?error=Error editing product');
//             }
//         }
//     });
// };
exports.editProduct =async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Error uploading files:', err);
            return res.redirect('/admin/product?error=Error uploading files');
        } else {
            try {
                const { productName, description, category, regularPrice, salePrice, productOffer, quantity, removedImages } = req.body;

                const productImages = req.files.length ? req.files.map(file => '/uploads/' + file.filename) : [];

                const product = await Product.findById(req.params.id);

                product.productName = productName;
                product.description = description;
                product.category = category;
                product.regularPrice = regularPrice;
                product.salePrice = salePrice;
                product.productOffer = productOffer;
                product.quantity = quantity;
                
                // Handle removed images
                if (removedImages) {
                    const removedIndexes = removedImages.split(',').map(Number);
                    product.productImage = product.productImage.filter((_, index) => !removedIndexes.includes(index));
                }

                // Add new images
                if (productImages.length > 0) {
                    product.productImage.push(...productImages);
                }

                await product.save();
                return res.redirect('/admin/product?success=Product updated successfully');
            } catch (error) {
                console.error('Error editing product:', error);
                return res.redirect('/admin/product?error=Error editing product');
            }
        }
    });
};
exports.uploadImage = (req, res) => {
    const uploadSingle = multer({
        storage: storage,
        limits: { fileSize: 1000000 },
        fileFilter: (req, file, cb) => {
            const filetypes = /jpeg|jpg|png|gif/;
            const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = filetypes.test(file.mimetype);
            if (mimetype && extname) {
                return cb(null, true);
            } else {
                cb('Error: Images Only!');
            }
        }
    }).single('productImage');

    uploadSingle(req, res, (err) => {
        if (err) {
            console.error('Error uploading file:', err);
            return res.status(500).send('Error uploading file');
        } else {
            const file = req.file;
            if (!file) {
                return res.status(400).send('No file uploaded');
            }
            return res.status(200).send({ filePath: '/uploads/' + file.filename });
        }
    });
};
// exports.removeProductImage = async (req, res) => {
//     try {
//         const { productId, index } = req.body;
//         const product = await Product.findById(productId);

//         if (!product) {
//             return res.status(404).send('Product not found');
//         }

//         product.productImage.splice(index, 1); // Remove the image from the array
//         await product.save();

//         res.status(200).send('Image removed successfully');
//     } catch (error) {
//         console.error('Error removing image:', error);
//         res.status(500).send('Error removing image');
//     }
// };
exports.getProductPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of categories per page

        const options = {
            page,
            limit,
            sort: { name: 1 } // Sort by name in ascending order
        };
        const products = await Product.find().populate('category').skip((page - 1) * limit)
        .limit(limit)
        .exec();
        const count = await Category.countDocuments();
        const totalPages = Math.ceil(count / limit);
        res.render('product', { products,currentPage:page, totalPages });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.redirect('/admin/dashboard');
    }

};

exports.getAddEditProductPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        
        const product = req.params.id ? await Product.findById(req.params.id) : null;
        res.render('addEditProduct', { product, categories });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.redirect('/admin/product');
    }
};




exports.toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        product.isBlocked = !product.isBlocked;
        await product.save();
        res.json({ success: true, message: `Product ${product.isBlocked ? 'blocked' : 'unblocked'} successfully` });

        // res.redirect('/admin/product');
    } catch (error) {
        console.error('Error toggling product status:', error);
        res.redirect('/admin/product');
    }
};



// exports.removeProductImage = async (req, res) => {
//     try {
//         const { productId, index } = req.body;
//         const product = await Product.findById(productId);

//         if (!product) {
//             return res.status(404).send('Product not found');
//         }

//         product.productImage.splice(index, 1); // Remove the image from the array
//         await product.save();

//         res.status(200).send('Image removed successfully');
//     } catch (error) {
//         console.error('Error removing image:', error);
//         res.status(500).send('Error removing image');
//     }
// };
exports.removeProductImage = async (req, res) => {
    try {
        const { productId, index } = req.params;
        console.log(`Received request to delete image at index ${index} for product ${productId}`);
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        if (index >= product.productImage.length) {
            return res.status(400).json({ success: false, message: 'Invalid image index' });
        }

        // Remove the image from the array
        product.productImage.splice(index, 1);
        await product.save();
        console.log('Image removed successfully');
        res.status(200).json({ success: true, message: 'Image removed successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

