document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.toggle-block-form').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
        });

        form.querySelector('button').addEventListener('click', function() {
            const customerId = form.getAttribute('data-customer-id');
            const action = this.textContent.trim() === 'Block' ? 'block' : 'unblock';

            fetch(`/customers/toggle-block/${customerId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast(`User ${action}ed successfully`, 'success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showToast(`Failed to ${action} user`, 'error');
                }
            })
            .catch(error => {
                showToast(`Failed to ${action} user`, 'error');
            });
        });
    });

    function showToast(message, type) {
        const toastBody = document.getElementById('toast-body');
        toastBody.innerText = message;
        const toastElement = document.getElementById('toast');
        toastElement.classList.add(`toast-${type}`);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
});
