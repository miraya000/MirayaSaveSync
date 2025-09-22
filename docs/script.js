// Game Sync Website JavaScript

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initScrollEffects();
    initAnimations();
    initInteractiveElements();
    initParticleSystem();
    initTypingEffect();
    initCounterAnimation();
    initFormHandling();
    initDownloadButton();
});

// Navigation functionality
function initNavigation() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Close mobile menu if open
                if (navMenu) {
                    navMenu.classList.remove('active');
                }
            }
        });
    });
    
    // Mobile menu toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            this.classList.toggle('active');
        });
    }
}

// Scroll effects and navbar behavior
function initScrollEffects() {
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', function() {
        const currentScrollY = window.scrollY;
        
        // Navbar background and shadow
        if (currentScrollY > 100) {
            navbar.style.background = 'rgba(10, 10, 10, 0.98)';
            navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(10, 10, 10, 0.95)';
            navbar.style.boxShadow = 'none';
        }
        
        // Hide/show navbar on scroll
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
        
        // Parallax effect for hero section
        const hero = document.querySelector('.hero');
        if (hero && currentScrollY < window.innerHeight) {
            const parallaxSpeed = currentScrollY * 0.5;
            hero.style.transform = `translateY(${parallaxSpeed}px)`;
        }
    });
}

// Animation observers and effects
function initAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const fadeInObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for fade-in animation
    const animateElements = document.querySelectorAll('.feature-card, .platform-card, .contact-method');
    animateElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        fadeInObserver.observe(element);
    });
    
    // Add animate-in class styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
}

// Interactive elements and hover effects
function initInteractiveElements() {
    // Button hover effects
    const buttons = document.querySelectorAll('.btn, .platform-btn, .form-btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Feature card interactive effects
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-15px) rotateY(5deg)';
            this.style.boxShadow = '0 25px 50px rgba(99, 102, 241, 0.2)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) rotateY(0deg)';
            this.style.boxShadow = '0 20px 40px rgba(99, 102, 241, 0.1)';
        });
    });
    
    // Device animation controls
    const devices = document.querySelectorAll('.device');
    devices.forEach((device, index) => {
        device.addEventListener('mouseenter', function() {
            this.style.animationPlayState = 'paused';
            this.style.transform = 'translateY(-10px) scale(1.1)';
        });
        
        device.addEventListener('mouseleave', function() {
            this.style.animationPlayState = 'running';
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Particle system for background
function initParticleSystem() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-system';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
    `;
    document.body.appendChild(particleContainer);
    
    // Create floating particles
    for (let i = 0; i < 20; i++) {
        createParticle(particleContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    const size = Math.random() * 4 + 2;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;
    
    particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(45deg, #6366f1, #8b5cf6);
        border-radius: 50%;
        opacity: 0.3;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: particleFloat ${duration}s linear infinite;
        animation-delay: ${delay}s;
    `;
    
    container.appendChild(particle);
    
    // Add particle animation
    if (!document.querySelector('#particle-styles')) {
        const style = document.createElement('style');
        style.id = 'particle-styles';
        style.textContent = `
            @keyframes particleFloat {
                0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
                10% { opacity: 0.3; }
                90% { opacity: 0.3; }
                100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Typing effect for hero title
function initTypingEffect() {
    const heroTitle = document.querySelector('.hero-title');
    if (!heroTitle) return;
    
    const text = heroTitle.innerHTML;
    heroTitle.innerHTML = '';
    
    let i = 0;
    const typeWriter = function() {
        if (i < text.length) {
            if (text.charAt(i) === '<') {
                // Handle HTML tags
                const tagEnd = text.indexOf('>', i);
                heroTitle.innerHTML += text.substring(i, tagEnd + 1);
                i = tagEnd + 1;
            } else {
                heroTitle.innerHTML += text.charAt(i);
                i++;
            }
            setTimeout(typeWriter, 50);
        } else {
            // Add blinking cursor
            const cursor = document.createElement('span');
            cursor.textContent = '|';
            cursor.style.animation = 'blink 1s infinite';
            heroTitle.appendChild(cursor);
        }
    };
    
    // Add cursor blink animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(typeWriter, 1000);
}

// Counter animation for stats
function initCounterAnimation() {
    const stats = document.querySelectorAll('.stat-number');
    
    const countUp = (element, target) => {
        const increment = target / 100;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current).toLocaleString();
        }, 20);
    };
    
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.textContent.replace(/,/g, ''));
                countUp(entry.target, target);
                statsObserver.unobserve(entry.target);
            }
        });
    });
    
    stats.forEach(stat => {
        statsObserver.observe(stat);
    });
}

// Form handling and validation
function initFormHandling() {
    const contactForm = document.querySelector('.contact-form form');
    if (!contactForm) return;
    
    const inputs = contactForm.querySelectorAll('input, textarea');
    const submitBtn = contactForm.querySelector('.form-btn');
    
    // Input focus effects
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateY(-2px)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateY(0)';
        });
        
        // Real-time validation
        input.addEventListener('input', function() {
            validateInput(this);
        });
    });
    
    // Form submission
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        inputs.forEach(input => {
            if (!validateInput(input)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            // Simulate form submission
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Message Sent!';
                submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                
                setTimeout(() => {
                    contactForm.reset();
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
                    submitBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                    submitBtn.disabled = false;
                }, 2000);
            }, 1500);
        }
    });
}

function validateInput(input) {
    const value = input.value.trim();
    let isValid = true;
    
    // Remove previous error styling
    input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    
    if (input.hasAttribute('required') && !value) {
        isValid = false;
    } else if (input.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
        }
    }
    
    if (!isValid) {
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
    } else {
        input.style.borderColor = '#10b981';
        input.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
    }
    
    return isValid;
}

// Mouse cursor effects
document.addEventListener('mousemove', function(e) {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) {
        const newCursor = document.createElement('div');
        newCursor.className = 'custom-cursor';
        newCursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, #6366f1, transparent);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.5;
            transition: transform 0.1s ease;
        `;
        document.body.appendChild(newCursor);
    }
    
    const cursorElement = document.querySelector('.custom-cursor');
    cursorElement.style.left = e.clientX - 10 + 'px';
    cursorElement.style.top = e.clientY - 10 + 'px';
});

// Add loading screen
window.addEventListener('load', function() {
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="loader-spinner"></div>
            <p>Loading Game Sync...</p>
        </div>
    `;
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        transition: opacity 0.5s ease;
    `;
    
    const loaderStyles = document.createElement('style');
    loaderStyles.textContent = `
        .loader-content {
            text-align: center;
            color: white;
        }
        .loader-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(99, 102, 241, 0.3);
            border-top: 3px solid #6366f1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(loaderStyles);
    document.body.appendChild(loader);
    
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.remove();
        }, 500);
    }, 1000);
});

// Download button functionality
function initDownloadButton() {
    const downloadBtn = document.querySelector('.download-btn-main');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Add click animation
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Show download starting message
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting Download...';
            this.disabled = true;
            
            // Simulate download process
             setTimeout(() => {
                 // Direct link to release folder
                 const link = document.createElement('a');
                 link.href = 'https://github.com/yourusername/game-sync-electron/releases'; // Replace with your actual GitHub releases URL
                 link.target = '_blank';
                 link.click();
                 
                 // Show success message
                 this.innerHTML = '<i class="fas fa-check"></i> Redirecting...';
                 this.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                 
                 // Reset button after 2 seconds
                 setTimeout(() => {
                     this.innerHTML = originalText;
                     this.style.background = '';
                     this.disabled = false;
                 }, 2000);
                 
             }, 800);
        });
    }
}