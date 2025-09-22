// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Header scroll effect
    const header = document.querySelector('.header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = 'none';
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });
    
    // Observe stats
    const stats = document.querySelectorAll('.stat');
    stats.forEach((stat, index) => {
        stat.style.opacity = '0';
        stat.style.transform = 'translateY(30px)';
        stat.style.transition = `opacity 0.6s ease ${index * 0.2}s, transform 0.6s ease ${index * 0.2}s`;
        observer.observe(stat);
    });
    
    // Add hover effect to download buttons
    const downloadButtons = document.querySelectorAll('.btn-primary');
    downloadButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Mobile menu toggle (if needed in future)
    const createMobileMenu = () => {
        const nav = document.querySelector('.nav');
        const navLinks = document.querySelector('.nav-links');
        
        if (window.innerWidth <= 768) {
            if (!document.querySelector('.mobile-menu-toggle')) {
                const mobileToggle = document.createElement('button');
                mobileToggle.className = 'mobile-menu-toggle';
                mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
                mobileToggle.style.cssText = `
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    color: #6366f1;
                    cursor: pointer;
                    display: block;
                `;
                
                nav.appendChild(mobileToggle);
                
                mobileToggle.addEventListener('click', () => {
                    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
                });
            }
        }
    };
    
    // Check for mobile menu on resize
    window.addEventListener('resize', createMobileMenu);
    createMobileMenu();
});