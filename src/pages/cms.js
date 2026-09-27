/**
 * Made N More — Cloud Website CMS & Content Studio
 * Manage live public website copy, hero headers, announcement banner, contact info, FAQs,
 * Media Asset Manager (Google Drive URL converter & file uploader), and Blog / Articles Studio.
 */

import { fetchSiteContent, publishSiteContent, uploadCmsImage, getSettings } from '../data/store.js';
import { ICONS } from '../utils/icons.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let _activeCmsTab = 'hero'; // 'hero' | 'announcement' | 'contact' | 'faqs' | 'blogs' | 'about'
let _contentState = null;
let _loading = true;
let _publishing = false;
let _lastPublished = null;
let _source = 'cloud';

/**
 * Converts Google Drive sharing links, Dropbox links, and web URLs into direct embeddable image sources
 */
export function resolveImageUrl(inputUrl) {
  if (!inputUrl) return '';
  let url = inputUrl.trim();

  // 1. Google Drive sharing links:
  // e.g., https://drive.google.com/file/d/1ABCXYZ_123/view?usp=sharing or https://drive.google.com/open?id=1ABCXYZ_123
  const gDriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  // 2. Google Photos / Usercontent direct links
  if (url.includes('lh3.googleusercontent.com') || url.includes('googleusercontent.com')) {
    return url;
  }

  // 3. Dropbox links:
  if (url.includes('dropbox.com')) {
    return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  }

  return url;
}

export async function renderCms(container) {
  _loading = true;
  render(container);

  try {
    const res = await fetchSiteContent();
    if (res && res.content) {
      _contentState = JSON.parse(JSON.stringify(res.content));
      if (!_contentState.blogs) {
        _contentState.blogs = getDefaultBlogs();
      }
      _source = res.source || 'cloud';
      _lastPublished = res.updatedAt ? new Date(res.updatedAt).toLocaleTimeString() : null;
    }
  } catch (err) {
    console.error('Error fetching CMS content:', err);
  } finally {
    _loading = false;
    render(container);
  }
}

function getDefaultBlogs() {
  return [
    {
      id: 'blog_1',
      slug: 'pla-plus-vs-petg-functional-3d-printing',
      title: 'PLA+ vs PETG-HS: Choosing the Right Material for Functional 3D Parts',
      excerpt: 'A deep dive into thermal resistance, tensile strength, and layer adhesion characteristics for rapid engineering prototypes.',
      category: 'Materials & Engineering',
      author: 'Madenmore Engineering',
      publishedAt: '2026-09-20',
      readTime: '4 min read',
      coverImage: '/image/moon_lamp.webp',
      tags: ['3D Printing', 'Materials', 'PETG', 'Prototyping'],
      content: `When designing mechanical components or high-speed printer enclosures, material selection determines operational lifespan and strength.\n\n### PLA+ High-Speed\nPLA+ offers superior tensile rigidity, virtually zero warping during high-speed 300mm/s prints, and crisp visual surface finish. It is ideal for display models, organizers, and indoor aesthetic products.\n\n### PETG-HS\nPETG delivers superior impact resistance, chemical endurance against oils/solvents, and continuous temperature resistance up to 75°C. Recommended for functional brackets, mechanical gears, and outdoor installations.`
    },
    {
      id: 'blog_2',
      slug: 'custom-lithophane-moon-lamps-craftsmanship',
      title: 'The Art of Lithophanes: Turning Precious Memories into Luminous Moon Lamps',
      excerpt: 'How multi-layer light transmission algorithms convert family photos into textured celestial lamps with hand-calibrated finishes.',
      category: 'Art & Bespoke Gifts',
      author: 'Madenmore Creative Studio',
      publishedAt: '2026-09-24',
      readTime: '3 min read',
      coverImage: '/image/moon_lamp.webp',
      tags: ['Lithophane', 'Moon Lamp', 'Custom Gift', 'Art'],
      content: `Lithophanes date back to 19th-century European porcelain, but modern high-resolution FDM additive fabrication takes the medium to breathtaking dimensions.\n\nBy modulating layer thickness between 0.8mm and 3.2mm in calibrated ivory PLA, varying gradients of light pass through the curved sphere. When illuminated from within by warm LED diodes, the relief sculpture transforms into a photorealistic luminous globe.`
    }
  ];
}

function render(container) {
  if (_loading) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 100px 20px;">
        <div style="font-size:2.5rem;animation:spin 1s linear infinite;display:inline-block;margin-bottom:16px;">🔄</div>
        <h3 style="font-size:1.2rem;font-weight:700;">Loading Website Content...</h3>
        <p class="text-secondary" style="font-size:0.88rem;">Connecting to Cloud CMS Gateway</p>
      </div>
    `;
    return;
  }

  if (!_contentState) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 80px 20px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
        <h3 style="font-size:1.2rem;font-weight:700;">Could not load website content</h3>
        <p class="text-secondary" style="font-size:0.88rem;margin-bottom:16px;">Please check if the cloud website is running on port 3000.</p>
        <button class="btn btn-primary" id="btn-cms-retry">Retry Connection</button>
      </div>
    `;
    container.querySelector('#btn-cms-retry')?.addEventListener('click', () => renderCms(container));
    return;
  }

  const c = _contentState;
  if (!c.blogs) c.blogs = getDefaultBlogs();
  const settings = getSettings();
  const websiteUrl = settings.cloudApiUrl || 'http://localhost:3000';

  container.innerHTML = `
    <div class="cms-container animate-in">
      <!-- Header -->
      <div class="page-header" style="margin-bottom: var(--space-md);">
        <div class="page-header-left">
          <div style="display:flex;align-items:center;gap:12px;">
            <h1 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.5px;">Website CMS & Content Studio</h1>
            <span class="badge" style="background:${_source === 'cloud' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'};color:${_source === 'cloud' ? '#22c55e' : '#f59e0b'};border:1px solid ${_source === 'cloud' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};font-weight:700;font-size:0.75rem;padding:4px 10px;border-radius:20px;">
              ${_source === 'cloud' ? '🟢 Cloud Gateway Live' : '🟠 Local Draft Mode'}
            </span>
          </div>
          <p class="text-secondary" style="font-size:0.88rem;margin-top:2px;">
            Manage public website copy, hero headers, media uploads, blog articles, and FAQs in real time
          </p>
        </div>
        <div class="page-header-actions" style="display:flex;gap:10px;align-items:center;">
          <a href="${websiteUrl}" target="_blank" class="btn btn-secondary" style="text-decoration:none;" title="Open live public website">
            <span>🌐</span>
            <span>Visit Website</span>
          </a>
          <button class="btn btn-secondary" id="btn-cms-fetch" title="Fetch latest published content from website">
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button class="btn btn-primary" id="btn-cms-publish" ${_publishing ? 'disabled' : ''} style="box-shadow: 0 2px 14px rgba(139,92,246,0.4);">
            <span style="display:inline-block;${_publishing ? 'animation:spin 1s linear infinite;' : ''}">🚀</span>
            <span>${_publishing ? 'Publishing...' : 'Publish to Cloud'}</span>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="filter-pills" style="margin-bottom: var(--space-md); border-bottom: 1px solid var(--border); padding-bottom: 12px; gap:8px;">
        <button class="filter-pill ${_activeCmsTab === 'hero' ? 'active' : ''}" data-tab="hero">
          ✨ Hero & Branding
        </button>
        <button class="filter-pill ${_activeCmsTab === 'blogs' ? 'active' : ''}" data-tab="blogs">
          📝 Blogs & Articles (${c.blogs?.length || 0})
        </button>
        <button class="filter-pill ${_activeCmsTab === 'announcement' ? 'active' : ''}" data-tab="announcement">
          📢 Announcement Bar ${c.announcement?.enabled ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-left:4px;"></span>' : ''}
        </button>
        <button class="filter-pill ${_activeCmsTab === 'contact' ? 'active' : ''}" data-tab="contact">
          🏢 Store & Contact
        </button>
        <button class="filter-pill ${_activeCmsTab === 'faqs' ? 'active' : ''}" data-tab="faqs">
          ❓ FAQ Studio (${c.faqs?.length || 0})
        </button>
        <button class="filter-pill ${_activeCmsTab === 'about' ? 'active' : ''}" data-tab="about">
          📖 About & Story
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="cms-tab-content">
        ${renderActiveTab(c)}
      </div>
    </div>
  `;

  attachEvents(container);
}

function renderActiveTab(c) {
  switch (_activeCmsTab) {
    case 'hero':
      return renderHeroTab(c);
    case 'blogs':
      return renderBlogsTab(c);
    case 'announcement':
      return renderAnnouncementTab(c);
    case 'contact':
      return renderContactTab(c);
    case 'faqs':
      return renderFaqsTab(c);
    case 'about':
      return renderAboutTab(c);
    default:
      return renderHeroTab(c);
  }
}

function renderHeroTab(c) {
  const hero = c.hero || {};
  const labsHero = c.labsHero || {};
  const brand = c.brand || {};
  const resolvedHeroImg = resolveImageUrl(hero.featuredImage || '/image/moon_lamp.webp');

  return `
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px;">
      <!-- Main Store Hero Editor -->
      <div class="card" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:1.2rem;">✨</span>
          <h3 style="font-size:1.05rem;font-weight:700;">Main Store Hero Section</h3>
        </div>

        <div class="form-group">
          <label class="form-label">Hero Badge Text</label>
          <input class="form-input" id="inp-hero-badge" value="${escapeHtml(hero.badge || '')}" placeholder="e.g. Precision 3D Craftsmanship" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Title (Main Part)</label>
            <input class="form-input" id="inp-hero-title" value="${escapeHtml(hero.title || '')}" placeholder="e.g. Printed with Soul." />
          </div>
          <div class="form-group">
            <label class="form-label">Title (Gradient Highlight)</label>
            <input class="form-input" id="inp-hero-highlight" value="${escapeHtml(hero.highlightText || '')}" placeholder="e.g. Built with Precision." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subtitle / Description</label>
          <textarea class="form-textarea" id="inp-hero-subtitle" rows="3" placeholder="Brief tagline explaining your studio offerings...">${escapeHtml(hero.subtitle || '')}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Primary Button Text</label>
            <input class="form-input" id="inp-hero-cta1-text" value="${escapeHtml(hero.primaryCtaText || 'Explore Catalog')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Primary Button Link</label>
            <input class="form-input" id="inp-hero-cta1-link" value="${escapeHtml(hero.primaryCtaLink || '/catalog')}" />
          </div>
        </div>

        <!-- Featured Image with Upload & Google Drive Link Support -->
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex;justify-content:space-between;">
            <span>Featured Hero Image (Upload File, Google Drive link or Web URL)</span>
            <span style="font-size:0.75rem;color:#38bdf8;">Auto-converts Google Drive links</span>
          </label>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input class="form-input" id="inp-hero-image" value="${escapeHtml(hero.featuredImage || '')}" placeholder="Paste Google Drive link, web URL, or upload below..." />
            <label class="btn btn-secondary" style="cursor:pointer;white-space:nowrap;">
              📁 Upload
              <input type="file" id="file-hero-image" accept="image/*" style="display:none;" />
            </label>
          </div>

          <div id="hero-img-preview-box" style="margin-top:8px;padding:10px;background:rgba(255,255,255,0.02);border:1px dashed var(--border);border-radius:var(--radius-md);display:flex;align-items:center;gap:14px;">
            <img id="hero-img-preview" src="${resolvedHeroImg}" alt="Hero Preview" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid var(--border);" onerror="this.src='/Logo/logo.png'" />
            <div>
              <div style="font-size:0.82rem;font-weight:600;color:var(--text-primary);">Live Hero Preview</div>
              <div style="font-size:0.74rem;color:var(--text-secondary);word-break:break-all;" id="hero-img-resolved-url">${resolvedHeroImg}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: ALPS Labs Hero & Brand Tagline -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="font-size:1.2rem;">🔬</span>
            <h3 style="font-size:1.05rem;font-weight:700;">ALPS 3D Printing Labs Section</h3>
          </div>

          <div class="form-group">
            <label class="form-label">Labs Badge</label>
            <input class="form-input" id="inp-labs-badge" value="${escapeHtml(labsHero.badge || '')}" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Title</label>
              <input class="form-input" id="inp-labs-title" value="${escapeHtml(labsHero.title || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Highlight Text</label>
              <input class="form-input" id="inp-labs-highlight" value="${escapeHtml(labsHero.highlightText || '')}" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Labs Subtitle</label>
            <textarea class="form-textarea" id="inp-labs-subtitle" rows="2">${escapeHtml(labsHero.subtitle || '')}</textarea>
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span style="font-size:1.2rem;">🏷️</span>
            <h3 style="font-size:1.05rem;font-weight:700;">Brand Identity & Slogan</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Brand Name</label>
            <input class="form-input" id="inp-brand-name" value="${escapeHtml(brand.name || 'Madenmore')}" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Tagline</label>
            <input class="form-input" id="inp-brand-tagline" value="${escapeHtml(brand.tagline || '')}" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBlogsTab(c) {
  const blogs = c.blogs || [];

  return `
    <div style="max-width:1050px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:3px;">Public Blog & Insights Studio</h3>
          <p class="text-secondary" style="font-size:0.84rem;">Publish articles, materials guides, tutorials, and farm updates to your public website</p>
        </div>
        <button class="btn btn-primary" id="btn-create-blog">
          ${ICONS.plus}
          New Article
        </button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;" id="blogs-grid">
        ${blogs.length === 0 ? `
          <div class="empty-state" style="grid-column:1/-1;padding:60px 20px;">
            <div style="font-size:2.5rem;margin-bottom:12px;">✍️</div>
            <h3 style="font-size:1.1rem;font-weight:700;">No Blog Articles Found</h3>
            <p class="text-secondary" style="font-size:0.85rem;margin-bottom:16px;">Create engineering guides and case studies to attract organic website traffic.</p>
            <button class="btn btn-primary" id="btn-create-blog-empty">Write First Article</button>
          </div>
        ` : blogs.map((blog, idx) => {
          const cover = resolveImageUrl(blog.coverImage || '/image/moon_lamp.webp');
          return `
            <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--radius-lg);transition:all 0.2s ease;">
              <div style="position:relative;height:140px;width:100%;overflow:hidden;background:#0d1117;">
                <img src="${cover}" alt="${escapeHtml(blog.title)}" style="width:100%;height:100%;object-fit:cover;transition:transform 0.3s ease;" onerror="this.src='/Logo/logo.png'" />
                <span class="badge" style="position:absolute;top:10px;left:10px;background:rgba(11,13,23,0.85);backdrop-filter:blur(8px);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-size:0.7rem;font-weight:700;padding:3px 8px;border-radius:12px;">
                  ${escapeHtml(blog.category || 'Engineering')}
                </span>
                <span style="position:absolute;bottom:8px;right:10px;font-size:0.72rem;background:rgba(0,0,0,0.7);color:#fff;padding:2px 8px;border-radius:10px;">
                  ⏱️ ${escapeHtml(blog.readTime || '3 min')}
                </span>
              </div>
              <div style="padding:16px;display:flex;flex-direction:column;flex:1;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;">
                  📅 ${blog.publishedAt || 'Recent'} • ✍️ ${escapeHtml(blog.author || 'Madenmore')}
                </div>
                <h4 style="font-size:0.95rem;font-weight:700;line-height:1.3;margin-bottom:8px;color:var(--text-primary);">
                  ${escapeHtml(blog.title)}
                </h4>
                <p class="text-secondary" style="font-size:0.8rem;line-height:1.4;margin-bottom:14px;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${escapeHtml(blog.excerpt || '')}
                </p>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px;margin-top:auto;">
                  <button class="btn btn-secondary btn-sm btn-edit-blog" data-idx="${idx}" style="font-size:0.78rem;">
                    ${ICONS.edit} Edit Article
                  </button>
                  <button class="btn-icon btn-sm btn-delete-blog" data-idx="${idx}" title="Delete Article" style="color:var(--danger);">
                    ${ICONS.trash}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderAnnouncementTab(c) {
  const ann = c.announcement || { enabled: true, text: '', linkUrl: '' };

  return `
    <div style="max-width:800px;margin:0 auto;">
      <div class="card" style="padding:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">📢</span>
            <div>
              <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:2px;">Top Announcement Banner</h3>
              <p class="text-secondary" style="font-size:0.8rem;">Displays at the very top of all public website pages</p>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <span style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Enable Banner:</span>
            <input type="checkbox" id="inp-ann-enabled" ${ann.enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:#38bdf8;cursor:pointer;" />
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Announcement Banner Text</label>
          <input class="form-input" id="inp-ann-text" value="${escapeHtml(ann.text || '')}" placeholder="⚡ Free Shipping on orders over ₹1,999 | Express 48h Custom Dispatch Available" />
        </div>

        <div class="form-group">
          <label class="form-label">Target Link (When clicked)</label>
          <input class="form-input" id="inp-ann-link" value="${escapeHtml(ann.linkUrl || '')}" placeholder="/catalog or /contact" />
        </div>

        <!-- Live Preview Box -->
        <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
          <label class="form-label" style="margin-bottom:8px;display:block;">Live Banner Preview</label>
          <div id="ann-live-preview" style="background:linear-gradient(90deg, #3b82f6, #8b5cf6);color:#fff;padding:8px 16px;border-radius:var(--radius-md);text-align:center;font-size:0.82rem;font-weight:600;box-shadow:0 4px 14px rgba(59,130,246,0.3);opacity:${ann.enabled ? '1' : '0.4'};">
            ${escapeHtml(ann.text || 'Announcement banner preview text')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderContactTab(c) {
  const brand = c.brand || {};

  return `
    <div style="max-width:850px;margin:0 auto;">
      <div class="card" style="padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <span style="font-size:1.4rem;">🏢</span>
          <div>
            <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:2px;">Studio Details & Contact Channels</h3>
            <p class="text-secondary" style="font-size:0.8rem;">Shown in website footer, contact form, and customer invoices</p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">WhatsApp Number (with country code, no + or spaces)</label>
            <div style="display:flex;gap:8px;">
              <input class="form-input" id="inp-contact-whatsapp" value="${escapeHtml(brand.whatsappNumber || '')}" placeholder="918999385228" />
              <a href="https://wa.me/${brand.whatsappNumber || ''}" target="_blank" class="btn btn-secondary" style="text-decoration:none;" title="Test WhatsApp Direct Link">
                💬 Test
              </a>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Display Phone Number</label>
            <input class="form-input" id="inp-contact-phone" value="${escapeHtml(brand.contactPhone || '')}" placeholder="+91 89993 85228" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Support / Official Email Address</label>
          <input class="form-input" type="email" id="inp-contact-email" value="${escapeHtml(brand.contactEmail || '')}" placeholder="makenmore07@gmail.com" />
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Physical Workshop / Studio Address</label>
          <textarea class="form-textarea" id="inp-contact-address" rows="3" placeholder="Full street address, building, city, pin code...">${escapeHtml(brand.address || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function renderFaqsTab(c) {
  const faqs = c.faqs || [];

  return `
    <div style="max-width:900px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:2px;">Frequently Asked Questions</h3>
          <p class="text-secondary" style="font-size:0.8rem;">Add and edit customer support answers displayed on the website</p>
        </div>
        <button class="btn btn-primary" id="btn-faq-add">
          ${ICONS.plus}
          Add New FAQ
        </button>
      </div>

      <div id="faq-list" style="display:flex;flex-direction:column;gap:12px;">
        ${faqs.length === 0 ? `
          <div class="empty-state" style="padding:40px 20px;">
            <p class="text-secondary">No FAQs found. Click "Add New FAQ" to create one.</p>
          </div>
        ` : faqs.map((faq, idx) => `
          <div class="card" style="padding:16px;background:rgba(255,255,255,0.02);" data-faq-index="${idx}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:8px;flex:1;">
                <span style="font-weight:700;color:var(--accent);font-size:0.85rem;">Q${idx + 1}:</span>
                <input class="form-input faq-question-input" data-index="${idx}" value="${escapeHtml(faq.question)}" placeholder="Question title..." style="font-weight:600;height:36px;" />
              </div>
              <button class="btn-icon btn-sm btn-faq-delete" data-index="${idx}" title="Delete FAQ" style="color:var(--danger);">
                ${ICONS.trash}
              </button>
            </div>
            <div style="padding-left:28px;">
              <textarea class="form-textarea faq-answer-input" data-index="${idx}" rows="2" placeholder="Detailed answer...">${escapeHtml(faq.answer)}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAboutTab(c) {
  const about = c.about || {};
  const story = (about.storyParagraphs || []).join('\n\n');
  const stats = about.stats || [];

  return `
    <div style="max-width:850px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">
      <div class="card" style="padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-size:1.3rem;">📖</span>
          <h3 style="font-size:1.05rem;font-weight:700;">Studio Story & Mission</h3>
        </div>

        <div class="form-group">
          <label class="form-label">About Heading</label>
          <input class="form-input" id="inp-about-title" value="${escapeHtml(about.title || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label">About Subtitle</label>
          <input class="form-input" id="inp-about-subtitle" value="${escapeHtml(about.subtitle || '')}" />
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Story Paragraphs (separate paragraphs with blank lines)</label>
          <textarea class="form-textarea" id="inp-about-story" rows="5">${escapeHtml(story)}</textarea>
        </div>
      </div>

      <div class="card" style="padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-size:1.3rem;">📊</span>
          <h3 style="font-size:1.05rem;font-weight:700;">Key Studio Highlights & Metric Counters</h3>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          ${stats.map((st, i) => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
              <div class="form-group" style="margin-bottom:6px;">
                <label class="form-label" style="font-size:0.75rem;">Label ${i + 1}</label>
                <input class="form-input stat-label-inp" data-stat-idx="${i}" value="${escapeHtml(st.label || '')}" style="height:34px;font-size:0.82rem;" />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.75rem;">Metric Value</label>
                <input class="form-input stat-val-inp" data-stat-idx="${i}" value="${escapeHtml(st.value || '')}" style="height:34px;font-size:0.82rem;font-weight:700;color:var(--accent);" />
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function openBlogEditorModal(existingBlog = null, onSaved) {
  const isNew = !existingBlog;
  let blogData = existingBlog ? { ...existingBlog } : {
    id: `blog_${Date.now()}`,
    title: '',
    slug: '',
    category: 'Materials & Engineering',
    author: 'Madenmore Engineering',
    publishedAt: new Date().toISOString().split('T')[0],
    readTime: '4 min read',
    coverImage: '/image/moon_lamp.webp',
    excerpt: '',
    content: '',
    tags: ['3D Printing', 'Prototyping']
  };

  showModal({
    title: isNew ? '✍️ Create New Blog Article' : '✏️ Edit Blog Article',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow-y:auto;padding-right:4px;">
        <div class="form-group">
          <label class="form-label">Article Title *</label>
          <input class="form-input" id="be-title" value="${escapeHtml(blogData.title)}" placeholder="e.g. 5 Pro Tips for High-Speed TPU 3D Printing" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">URL Slug (auto-generated)</label>
            <input class="form-input" id="be-slug" value="${escapeHtml(blogData.slug)}" placeholder="5-pro-tips-for-tpu" />
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="be-category">
              <option value="Materials & Engineering" ${blogData.category === 'Materials & Engineering' ? 'selected' : ''}>Materials & Engineering</option>
              <option value="Art & Bespoke Gifts" ${blogData.category === 'Art & Bespoke Gifts' ? 'selected' : ''}>Art & Bespoke Gifts</option>
              <option value="Farm Operations" ${blogData.category === 'Farm Operations' ? 'selected' : ''}>Farm Operations & Hardware</option>
              <option value="Tutorials & Guides" ${blogData.category === 'Tutorials & Guides' ? 'selected' : ''}>Tutorials & Guides</option>
              <option value="Customer Spotlights" ${blogData.category === 'Customer Spotlights' ? 'selected' : ''}>Customer Spotlights</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Author Name</label>
            <input class="form-input" id="be-author" value="${escapeHtml(blogData.author)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Read Time</label>
            <input class="form-input" id="be-readtime" value="${escapeHtml(blogData.readTime)}" placeholder="e.g. 4 min read" />
          </div>
          <div class="form-group">
            <label class="form-label">Publish Date</label>
            <input class="form-input" type="date" id="be-date" value="${blogData.publishedAt || ''}" />
          </div>
        </div>

        <!-- Cover Image with Upload & Google Link Converter -->
        <div class="form-group">
          <label class="form-label" style="display:flex;justify-content:space-between;">
            <span>Cover Image (Upload File, Google Drive link, or URL)</span>
            <span style="font-size:0.75rem;color:#38bdf8;">Google Drive links supported</span>
          </label>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="be-cover" value="${escapeHtml(blogData.coverImage)}" placeholder="Paste Google Drive link or file URL..." />
            <label class="btn btn-secondary" style="cursor:pointer;white-space:nowrap;">
              📁 Upload
              <input type="file" id="be-file-upload" accept="image/*" style="display:none;" />
            </label>
          </div>
          <div style="margin-top:8px;display:flex;align-items:center;gap:12px;padding:8px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-md);">
            <img id="be-cover-preview" src="${resolveImageUrl(blogData.coverImage)}" alt="Cover" style="width:64px;height:48px;border-radius:6px;object-fit:cover;" onerror="this.src='/Logo/logo.png'" />
            <div style="font-size:0.75rem;color:var(--text-secondary);word-break:break-all;" id="be-resolved-text">
              ${resolveImageUrl(blogData.coverImage)}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Short Excerpt / Summary</label>
          <textarea class="form-textarea" id="be-excerpt" rows="2" placeholder="Catchy summary for Google SEO and catalog cards...">${escapeHtml(blogData.excerpt)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Tags (comma-separated)</label>
          <input class="form-input" id="be-tags" value="${escapeHtml((blogData.tags || []).join(', '))}" placeholder="3D Printing, TPU, Tips, Voron" />
        </div>

        <div class="form-group">
          <label class="form-label">Article Body Content (Markdown supported)</label>
          <textarea class="form-textarea" id="be-content" rows="8" placeholder="Write your full article here. Use ## Headings, - bullet points, and paragraphs...">${escapeHtml(blogData.content)}</textarea>
        </div>
      </div>
    `,
    confirmText: isNew ? 'Create Article' : 'Save Changes',
    onReady: () => {
      const titleInput = document.getElementById('be-title');
      const slugInput = document.getElementById('be-slug');
      const coverInput = document.getElementById('be-cover');
      const coverImg = document.getElementById('be-cover-preview');
      const resolvedText = document.getElementById('be-resolved-text');
      const fileInput = document.getElementById('be-file-upload');

      // Auto-generate slug when title changes
      if (titleInput && slugInput) {
        titleInput.addEventListener('input', () => {
          if (isNew || !slugInput.value) {
            slugInput.value = titleInput.value
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');
          }
        });
      }

      // Live Google Drive & URL Converter
      if (coverInput && coverImg && resolvedText) {
        coverInput.addEventListener('input', () => {
          const resolved = resolveImageUrl(coverInput.value);
          coverImg.src = resolved;
          resolvedText.textContent = resolved;
        });
      }

      // File upload handler
      if (fileInput && coverInput && coverImg && resolvedText) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          showToast(`Uploading ${file.name}...`, 'info');
          try {
            const res = await uploadCmsImage(file);
            if (res && res.url) {
              coverInput.value = res.url;
              coverImg.src = res.url;
              resolvedText.textContent = res.url;
              showToast('Image uploaded successfully!', 'success');
            }
          } catch (err) {
            showToast(`Upload failed: ${err.message}`, 'error');
          }
        });
      }
    },
    onConfirm: () => {
      const title = document.getElementById('be-title')?.value.trim();
      if (!title) {
        showToast('Please enter an article title', 'warning');
        return false;
      }

      const slug = (document.getElementById('be-slug')?.value.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      const category = document.getElementById('be-category')?.value;
      const author = document.getElementById('be-author')?.value.trim() || 'Madenmore';
      const readTime = document.getElementById('be-readtime')?.value.trim() || '3 min read';
      const publishedAt = document.getElementById('be-date')?.value || new Date().toISOString().split('T')[0];
      const coverImage = resolveImageUrl(document.getElementById('be-cover')?.value.trim() || '/image/moon_lamp.webp');
      const excerpt = document.getElementById('be-excerpt')?.value.trim();
      const tags = (document.getElementById('be-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
      const content = document.getElementById('be-content')?.value;

      const savedArticle = {
        ...blogData,
        title,
        slug,
        category,
        author,
        readTime,
        publishedAt,
        coverImage,
        excerpt,
        tags,
        content
      };

      if (onSaved) onSaved(savedArticle);
      closeModal();
      return true;
    }
  });
}

function syncInputsToState(container) {
  if (!_contentState) return;

  if (_activeCmsTab === 'hero') {
    _contentState.hero = _contentState.hero || {};
    _contentState.hero.badge = container.querySelector('#inp-hero-badge')?.value || '';
    _contentState.hero.title = container.querySelector('#inp-hero-title')?.value || '';
    _contentState.hero.highlightText = container.querySelector('#inp-hero-highlight')?.value || '';
    _contentState.hero.subtitle = container.querySelector('#inp-hero-subtitle')?.value || '';
    _contentState.hero.primaryCtaText = container.querySelector('#inp-hero-cta1-text')?.value || '';
    _contentState.hero.primaryCtaLink = container.querySelector('#inp-hero-cta1-link')?.value || '';
    _contentState.hero.secondaryCtaText = container.querySelector('#inp-hero-cta2-text')?.value || '';
    _contentState.hero.secondaryCtaLink = container.querySelector('#inp-hero-cta2-link')?.value || '';
    _contentState.hero.featuredImage = resolveImageUrl(container.querySelector('#inp-hero-image')?.value || '');

    _contentState.labsHero = _contentState.labsHero || {};
    _contentState.labsHero.badge = container.querySelector('#inp-labs-badge')?.value || '';
    _contentState.labsHero.title = container.querySelector('#inp-labs-title')?.value || '';
    _contentState.labsHero.highlightText = container.querySelector('#inp-labs-highlight')?.value || '';
    _contentState.labsHero.subtitle = container.querySelector('#inp-labs-subtitle')?.value || '';

    _contentState.brand = _contentState.brand || {};
    _contentState.brand.name = container.querySelector('#inp-brand-name')?.value || 'Madenmore';
    _contentState.brand.tagline = container.querySelector('#inp-brand-tagline')?.value || '';
  } else if (_activeCmsTab === 'announcement') {
    _contentState.announcement = _contentState.announcement || {};
    _contentState.announcement.enabled = container.querySelector('#inp-ann-enabled')?.checked ?? true;
    _contentState.announcement.text = container.querySelector('#inp-ann-text')?.value || '';
    _contentState.announcement.linkUrl = container.querySelector('#inp-ann-link')?.value || '';
  } else if (_activeCmsTab === 'contact') {
    _contentState.brand = _contentState.brand || {};
    _contentState.brand.whatsappNumber = container.querySelector('#inp-contact-whatsapp')?.value || '';
    _contentState.brand.contactPhone = container.querySelector('#inp-contact-phone')?.value || '';
    _contentState.brand.contactEmail = container.querySelector('#inp-contact-email')?.value || '';
    _contentState.brand.address = container.querySelector('#inp-contact-address')?.value || '';
  } else if (_activeCmsTab === 'faqs') {
    const qInputs = container.querySelectorAll('.faq-question-input');
    const aInputs = container.querySelectorAll('.faq-answer-input');
    const newFaqs = [];
    qInputs.forEach((qi, i) => {
      newFaqs.push({
        question: qi.value.trim(),
        answer: aInputs[i] ? aInputs[i].value.trim() : ''
      });
    });
    _contentState.faqs = newFaqs;
  } else if (_activeCmsTab === 'about') {
    _contentState.about = _contentState.about || {};
    _contentState.about.title = container.querySelector('#inp-about-title')?.value || '';
    _contentState.about.subtitle = container.querySelector('#inp-about-subtitle')?.value || '';
    
    const storyRaw = container.querySelector('#inp-about-story')?.value || '';
    _contentState.about.storyParagraphs = storyRaw.split('\n\n').map(s => s.trim()).filter(Boolean);

    const labels = container.querySelectorAll('.stat-label-inp');
    const vals = container.querySelectorAll('.stat-val-inp');
    const stats = [];
    labels.forEach((l, i) => {
      stats.push({
        label: l.value.trim(),
        value: vals[i] ? vals[i].value.trim() : ''
      });
    });
    _contentState.about.stats = stats;
  }
}

function attachEvents(container) {
  // Tab Switching
  container.querySelectorAll('.filter-pill[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncInputsToState(container);
      _activeCmsTab = btn.dataset.tab;
      render(container);
    });
  });

  // Refresh from Cloud
  container.querySelector('#btn-cms-fetch')?.addEventListener('click', async () => {
    showToast('Fetching live website content...', 'info');
    await renderCms(container);
    showToast('Website content refreshed!', 'success');
  });

  // Publish to Cloud
  container.querySelector('#btn-cms-publish')?.addEventListener('click', async () => {
    syncInputsToState(container);
    _publishing = true;
    render(container);

    try {
      const res = await publishSiteContent(_contentState);
      if (res && res.success) {
        _lastPublished = new Date().toLocaleTimeString();
        _source = 'cloud';
        showToast('🚀 Successfully published changes to live website!', 'success');
      } else {
        showToast(res.cloudError || res.error || 'Saved locally (Cloud unavailable)', 'warning');
      }
    } catch (err) {
      showToast(`Publish error: ${err.message}`, 'error');
    } finally {
      _publishing = false;
      render(container);
    }
  });

  // Hero Image URL Converter & File Upload
  const heroImgInp = container.querySelector('#inp-hero-image');
  const heroImgPreview = container.querySelector('#hero-img-preview');
  const heroImgResolved = container.querySelector('#hero-img-resolved-url');
  const heroFileInp = container.querySelector('#file-hero-image');

  if (heroImgInp && heroImgPreview && heroImgResolved) {
    heroImgInp.addEventListener('input', () => {
      const resolved = resolveImageUrl(heroImgInp.value);
      heroImgPreview.src = resolved;
      heroImgResolved.textContent = resolved;
    });
  }

  if (heroFileInp && heroImgInp && heroImgPreview && heroImgResolved) {
    heroFileInp.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      showToast(`Uploading ${file.name}...`, 'info');
      try {
        const res = await uploadCmsImage(file);
        if (res && res.url) {
          heroImgInp.value = res.url;
          heroImgPreview.src = res.url;
          heroImgResolved.textContent = res.url;
          showToast('Hero image uploaded successfully!', 'success');
        }
      } catch (err) {
        showToast(`Upload failed: ${err.message}`, 'error');
      }
    });
  }

  // Announcement Live preview typing handler
  const annInput = container.querySelector('#inp-ann-text');
  const annCheck = container.querySelector('#inp-ann-enabled');
  const annPreview = container.querySelector('#ann-live-preview');
  if (annInput && annPreview) {
    annInput.addEventListener('input', () => {
      annPreview.textContent = annInput.value || 'Announcement banner preview text';
    });
  }
  if (annCheck && annPreview) {
    annCheck.addEventListener('change', () => {
      annPreview.style.opacity = annCheck.checked ? '1' : '0.4';
    });
  }

  // FAQ Add
  container.querySelector('#btn-faq-add')?.addEventListener('click', () => {
    syncInputsToState(container);
    _contentState.faqs = _contentState.faqs || [];
    _contentState.faqs.push({
      question: 'New Question',
      answer: 'Add your answer here...'
    });
    render(container);
  });

  // FAQ Delete
  container.querySelectorAll('.btn-faq-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      syncInputsToState(container);
      if (_contentState.faqs && _contentState.faqs[idx]) {
        _contentState.faqs.splice(idx, 1);
        render(container);
        showToast('FAQ removed', 'info');
      }
    });
  });

  // Blog Article Creation
  container.querySelector('#btn-create-blog')?.addEventListener('click', () => {
    openBlogEditorModal(null, (newArticle) => {
      _contentState.blogs = _contentState.blogs || [];
      _contentState.blogs.unshift(newArticle);
      render(container);
      showToast('Created new article draft!', 'success');
    });
  });

  container.querySelector('#btn-create-blog-empty')?.addEventListener('click', () => {
    openBlogEditorModal(null, (newArticle) => {
      _contentState.blogs = _contentState.blogs || [];
      _contentState.blogs.unshift(newArticle);
      render(container);
      showToast('Created new article draft!', 'success');
    });
  });

  // Blog Article Edit
  container.querySelectorAll('.btn-edit-blog').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const blog = _contentState.blogs && _contentState.blogs[idx];
      if (blog) {
        openBlogEditorModal(blog, (updatedArticle) => {
          _contentState.blogs[idx] = updatedArticle;
          render(container);
          showToast('Updated article!', 'success');
        });
      }
    });
  });

  // Blog Article Delete
  container.querySelectorAll('.btn-delete-blog').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (_contentState.blogs && _contentState.blogs[idx]) {
        const title = _contentState.blogs[idx].title;
        _contentState.blogs.splice(idx, 1);
        render(container);
        showToast(`Deleted "${title}"`, 'info');
      }
    });
  });
}
