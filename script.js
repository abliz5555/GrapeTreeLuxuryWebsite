window.addEventListener('load', () => {
    document.body.style.opacity = "1";
});

const counters = document.querySelectorAll('.counter');

counters.forEach(counter => {

    const updateCounter = () => {
        const target = +counter.getAttribute('data-target');
        const current = +counter.innerText;
        const increment = target / 50;

        if (current < target) {
            counter.innerText = Math.ceil(current + increment);
            setTimeout(updateCounter, 30);
        } else {
            counter.innerText = target;
        }
    };

    updateCounter();

});

window.addEventListener('scroll', () => {

    const cards = document.querySelectorAll(
        '.item, .brand-card, .why-card, .gallery-container img, .trust-box, .stat-box'
    );

    cards.forEach(card => {

        const top = card.getBoundingClientRect().top;

        if (top < window.innerHeight - 100) {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }

    });

});
const menuToggle = document.getElementById('menu-toggle');

const navMenu = document.getElementById('nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});
document.querySelectorAll('#nav-menu a')
    .forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
    document.addEventListener("DOMContentLoaded", () => {
   
    
});
