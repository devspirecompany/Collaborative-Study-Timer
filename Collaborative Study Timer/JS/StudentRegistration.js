const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.querySelector('.eye-icon').style.opacity = type === 'password' ? '0.6' : '1';
});

toggleConfirmPassword.addEventListener('click', function() {
    const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPasswordInput.setAttribute('type', type);
    this.querySelector('.eye-icon').style.opacity = type === 'password' ? '0.6' : '1';
});

const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');

passwordInput.addEventListener('input', function() {
    const password = this.value;
    const strength = calculatePasswordStrength(password);
    
    updateStrengthIndicator(strength);
});

function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length === 0) return 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    
    return Math.min(strength, 100);
}

function updateStrengthIndicator(strength) {
    strengthFill.style.width = strength + '%';
    
    if (strength === 0) {
        strengthFill.style.background = 'transparent';
        strengthText.textContent = 'Password strength';
        strengthText.style.color = 'var(--text-muted)';
    } else if (strength < 40) {
        strengthFill.style.background = '#ef4444';
        strengthText.textContent = 'Weak password';
        strengthText.style.color = '#ef4444';
    } else if (strength < 70) {
        strengthFill.style.background = '#f59e0b';
        strengthText.textContent = 'Moderate password';
        strengthText.style.color = '#f59e0b';
    } else {
        strengthFill.style.background = '#10b981';
        strengthText.textContent = 'Strong password';
        strengthText.style.color = '#10b981';
    }
}

const registerForm = document.getElementById('registerForm');

registerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    if (!firstName || !lastName) {
        showNotification('Please enter your full name', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('Username must be at least 3 characters', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showNotification('Please agree to the Terms of Service', 'error');
        return;
    }
    
    const registerButton = this.querySelector('.btn-register');
    const originalText = registerButton.innerHTML;
    registerButton.innerHTML = '<span>Creating Account...</span>';
    registerButton.disabled = true;
    registerButton.style.opacity = '0.7';
    
    setTimeout(() => {
        const userData = {
            firstName,
            lastName,
            username,
            email,
            password
        };
        
        console.log('Registration data:', userData);
        
        showNotification('Account created successfully! Redirecting...', 'success');
        
        setTimeout(() => {
            console.log('Redirecting to SpireWorks login page...');
        }, 2000);
        
        registerButton.innerHTML = originalText;
        registerButton.disabled = false;
        registerButton.style.opacity = '1';
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

const usernameInput = document.getElementById('username');
usernameInput.addEventListener('input', function() {
    const username = this.value.trim();
    
    this.value = username.replace(/\s/g, '');
    
    if (username.length > 0 && username.length < 3) {
        this.style.borderColor = '#ef4444';
    } else if (username.length >= 3) {
        this.style.borderColor = '#10b981';
    } else {
        this.style.borderColor = 'transparent';
    }
});

const emailInput = document.getElementById('email');
emailInput.addEventListener('blur', function() {
    const email = this.value.trim();
    
    if (email.length > 0) {
        if (validateEmail(email)) {
            this.style.borderColor = '#10b981';
        } else {
            this.style.borderColor = '#ef4444';
        }
    } else {
        this.style.borderColor = 'transparent';
    }
});

confirmPasswordInput.addEventListener('input', function() {
    const password = passwordInput.value;
    const confirmPassword = this.value;
    
    if (confirmPassword.length > 0) {
        if (password === confirmPassword) {
            this.style.borderColor = '#10b981';
        } else {
            this.style.borderColor = '#ef4444';
        }
    } else {
        this.style.borderColor = 'transparent';
    }
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

console.log('SpireWorks Registration System Initialized ✓');
console.log('System: Collaborative Study Timer and Productivity Management');