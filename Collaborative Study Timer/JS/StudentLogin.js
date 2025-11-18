const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    this.querySelector('.eye-icon').style.opacity = type === 'password' ? '0.6' : '1';
});

const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!validateEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    const loginButton = this.querySelector('.btn-login');
    const originalText = loginButton.innerHTML;
    loginButton.innerHTML = '<span>Logging in...</span>';
    loginButton.disabled = true;
    loginButton.style.opacity = '0.7';
    
    setTimeout(() => {
        if (rememberMe) {
            console.log('Remember me enabled for:', email);
        }
        
        showNotification('Login successful! Redirecting to SpireWorks...', 'success');
        
        setTimeout(() => {
            console.log('Redirecting to SpireWorks dashboard...');
        }, 1500);
        
        loginButton.innerHTML = originalText;
        loginButton.disabled = false;
        loginButton.style.opacity = '1';
    }, 1500);
});

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        borderRadius: '0.75rem',
        fontSize: '0.95rem',
        fontWeight: '500',
        zIndex: '1000',
        animation: 'slideIn 0.3s ease',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
    });
    
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        notification.style.color = 'white';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        notification.style.color = 'white';
    } else {
        notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

const inputs = document.querySelectorAll('input');
inputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.01)';
        this.parentElement.style.transition = 'transform 0.2s ease';
    });
    
    input.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
    });
});

const guestButton = document.querySelector('.btn-guest');
guestButton.addEventListener('click', function() {
    this.disabled = true;
    this.style.opacity = '0.7';
    
    showNotification('Logging in as guest to SpireWorks...', 'info');
    
    setTimeout(() => {
        console.log('Guest login - redirecting to SpireWorks dashboard');
        this.disabled = false;
        this.style.opacity = '1';
    }, 1500);
});

const forgotPasswordLink = document.querySelector('.forgot-password');
forgotPasswordLink.addEventListener('click', function(e) {
    e.preventDefault();
    showNotification('Password reset link will be sent to your email', 'info');
});

const signUpLink = document.querySelector('.form-footer a');
signUpLink.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Redirecting to SpireWorks registration page');
});

window.addEventListener('load', function() {
    const logoImg = document.querySelector('.logo-img');
    if (logoImg) {
        logoImg.style.animation = 'fadeInScale 0.6s ease';
        
        const fadeInStyle = document.createElement('style');
        fadeInStyle.textContent = `
            @keyframes fadeInScale {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(fadeInStyle);
    }
});

console.log('SpireWorks Student Login System Initialized ✓');
console.log('System: Collaborative Study Timer and Productivity Management');