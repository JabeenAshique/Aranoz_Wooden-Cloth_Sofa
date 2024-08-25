 const Category = require('../../models/categorySchema');

// Get the category management page
exports.getCategoryPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of categories per page

        const options = {
            page,
            limit,
            sort: { name: 1 } // Sort by name in ascending order
        };
        const categories = await Category.find().skip((page - 1) * limit)
        .limit(limit)
        .exec();;
        const count = await Category.countDocuments();
        const totalPages = Math.ceil(count / limit);
        res.render("category", { categories, editCategory: null, currentPage:page, 
            totalPages  });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.redirect("/admin/dashboard");
    }
};


// Fetch a category for editing
exports.getEditCategory = async (req, res) => {
    try {
     
        const { id } = req.params;
        const categories = await Category.find();
        const editCategory = await Category.findById(id);
        res.render("category", { categories, editCategory });
    } catch (error) {
        console.error("Error fetching category for editing:", error);
        res.redirect("/admin/category");
    }
};

// Add a new category
exports.addCategory = async (req, res) => {
    try {
        const { name, description, categoryOffer } = req.body;
        //validation
        if (/^[_\s]/.test(name) || parseFloat(categoryOffer) < 0) {
            return res.redirect('/admin/category?error=Invalid input values');
        }
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.redirect('/admin/category?error=Category already exists');
        }
        const newCategory = new Category({ name, description, categoryOffer });
        await newCategory.save();
        res.redirect("/admin/category?success=Category added successfully");
    } catch (error) {
        console.error("Error adding category:", error);
        res.redirect("/admin/category?error=Error adding category");
    }
};

// Edit a category
exports.editCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, categoryOffer } = req.body;
          // Validate inputs
          if (/^[_\s]/.test(name) || parseFloat(categoryOffer) < 0) {
            return res.redirect('/admin/category?error=Invalid input values');
        }
        
        const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
        if (existingCategory) {
            return res.redirect('/admin/category?error=Category already exists');
        }
        await Category.findByIdAndUpdate(id, { name, description, categoryOffer });
        res.redirect("/admin/category?success=Category updated successfully");
    } catch (error) {
        console.error("Error editing category:", error);
        res.redirect("/admin/category?error=Error editing category");
    }
};

// Delete a category (soft delete)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await Category.findByIdAndUpdate(id, { isListed: false });
        res.redirect("/admin/category?success=Category unlisted successfully");
    } catch (error) {
        console.error("Error deleting category:", error);
        res.redirect("/admin/category?error=Error unlisting category");
    }
};

// Toggle category status (list/unlist)
exports.toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        category.isListed = !category.isListed;
        await category.save();
        res.redirect(`/admin/category?success=Category ${category.isListed ? 'listed' : 'unlisted'} successfully`);
    } catch (error) {
        console.error("Error toggling category status:", error);
        res.redirect("/admin/category?error=Error toggling category status");
    }
};
