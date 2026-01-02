// Navigation helper
document.addEventListener('DOMContentLoaded', () => {
    // Highlight active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || 
            (currentPage === 'index.html' && href.includes('index.html')) ||
            (currentPage === 'setup.html' && href.includes('setup.html'))) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

