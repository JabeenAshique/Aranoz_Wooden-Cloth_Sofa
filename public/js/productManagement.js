document.getElementById('productForm').addEventListener('submit', function(event) {
    let formValid = true;

    const productName = document.getElementById('productName');
    const description = document.getElementById('description');
    const author = document.getElementById('author');
    const category = document.getElementById('category');
    const regularPrice = document.getElementById('regularPrice');
    const salePrice = document.getElementById('salePrice');
    const productOffer = document.getElementById('productOffer');
    const quantity = document.getElementById('quantity');
    const productImage = document.getElementById('productImage');

    const setInvalid = (element, message) => {
        formValid = false;
        element.classList.add('is-invalid');
        element.nextElementSibling.textContent = message;
    };

    if (regularPrice.value < 0) {
        setInvalid(regularPrice, 'Regular price must be a positive number.');
    } else {
        setValid(regularPrice);
    }

    if (salePrice.value < 0) {
        setInvalid(salePrice, 'Sale price must be a positive number.');
    } else {
        setValid(salePrice);
    }

    if (productOffer.value < 0 || productOffer.value > 100) {
        setInvalid(productOffer, 'Product offer must be between 0 and 100.');
    } else {
        setValid(productOffer);
    }

  

    if (!productImage.value) {
        setInvalid(productImage, 'Product images are required.');
    } else {
        setValid(productImage);
    }

    if (!formValid) {
        event.preventDefault();
    }
});
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed');
  
    // Function to show toast messages
    function showToast(message) {
      const toastBody = document.getElementById('toast-body');
      toastBody.innerText = message;
      const toast = new bootstrap.Toast(document.getElementById('liveToast'));
      toast.show();
    }
  
    // Add event listeners to all remove buttons
    const removeButtons = document.querySelectorAll('.remove-image');
    console.log(`Found ${removeButtons.length} remove buttons`);
  
    removeButtons.forEach(button => {
      console.log(`Attaching event listener to button with index ${button.getAttribute('data-index')} and product ID ${button.getAttribute('data-product-id')}`);
      button.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent default form submission behavior
        const index = this.getAttribute('data-index');
        const productId = this.getAttribute('data-product-id');
        console.log(`Attempting to remove image at index ${index} for product ${productId}`);
  
        fetch('/admin/product/remove-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ productId, index })
        })
        .then(response => {
          if (response.ok) {
            console.log('Image removed successfully from the server.');
            this.parentElement.remove();
            showToast('Image removed successfully.');
          } else {
            console.log('Failed to remove image from the server.');
            showToast('Failed to remove image.');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showToast('Failed to remove image.');
        });
      });
    });
  
    // Handle new image preview and removal
    const productImageInput = document.getElementById('productImage');
    const newImageContainer = document.getElementById('new-image-container');
  
    productImageInput.addEventListener('change', function () {
      const files = Array.from(productImageInput.files);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
          const imageUrl = event.target.result;
          const imageItem = document.createElement('div');
          imageItem.classList.add('img-thumbnail-wrapper');
          imageItem.innerHTML = `
            <img src="${imageUrl}" alt="Product Image" class="img-thumbnail" style="width: 150px; height: auto;">
            <button type="button" class="btn btn-danger btn-sm remove-new-image">Remove</button>
          `;
          newImageContainer.appendChild(imageItem);
  
          const removeBtn = imageItem.querySelector('.remove-new-image');
          removeBtn.addEventListener('click', function () {
            newImageContainer.removeChild(imageItem);
          });
        };
        reader.readAsDataURL(file);
      });
    });
});