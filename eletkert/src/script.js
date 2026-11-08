import './common.js';
import './markets.js';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

const lightbox = new PhotoSwipeLightbox({
  gallery: '#my-gallery',
  children: 'a',
  showHideAnimationType: 'zoom',
  showAnimationDuration: 250,
  hideAnimationDuration: 250,
  pswpModule: () => import('photoswipe')
});
lightbox.init();
