import { ABOUT, LINKS, WORK, FAQ, CONTACT, DOWNLOADS, SITE } from "@/app/content";

function Tag({ children }) {
  return <span className="tag lg-glass">{children}</span>;
}

export function AboutContent() {
  return (
    <div className="panel">
      <div className="ph-block ph-portrait">portrait placeholder</div>
      <h3>{ABOUT.realName}</h3>
      <p className="muted">{ABOUT.location}</p>
      <p className="muted">{ABOUT.former}</p>
      <p>{ABOUT.blurb}</p>
      <p>{ABOUT.cta}</p>

      <h4>EDUCATION</h4>
      <ul>{ABOUT.education.map((e) => <li key={e}>{e}</li>)}</ul>

      <h4>OTHER INTERESTS</h4>
      <ul>{ABOUT.interests.map((e) => <li key={e}>{e}</li>)}</ul>

      <h4>LANGUAGE PROFICIENCY</h4>
      <p>{ABOUT.languages}</p>
    </div>
  );
}

export function LinksContent() {
  return (
    <div className="panel">
      <p className="muted">{LINKS.note}</p>
      <div className="link-grid">
        {LINKS.socials.map((l) => (
          <a key={l.label} className="link-pill lg-glass lg-press" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
        ))}
      </div>
      <h4>SHOP</h4>
      <div className="link-grid">
        {LINKS.shop.map((l) => (
          <a key={l.label} className="link-pill lg-glass lg-press" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
        ))}
      </div>
    </div>
  );
}

export function WorkContent() {
  return (
    <div className="panel">
      <p>{WORK.intro}</p>

      <h4>TOOLS</h4>
      <div className="tags">{WORK.tools.map((t, i) => <Tag key={i}>{t}</Tag>)}</div>

      <h4>DEVELOPMENT</h4>
      <div className="tags">{WORK.development.map((t, i) => <Tag key={i}>{t}</Tag>)}</div>

      <h4>ANIMATION</h4>
      <div className="card-grid">
        {WORK.animation.map((p, i) => (
          <div className="card lg-glass" key={i}>
            <div className="ph-block ph-thumb">video placeholder</div>
            <strong>{p.title}</strong>
            <span className="muted">{p.note}</span>
          </div>
        ))}
      </div>

      <h4>ILLUSTRATION</h4>
      <div className="card-grid">
        {WORK.illustration.map((p, i) => (
          <div className="card lg-glass" key={i}>
            <div className="ph-block ph-thumb">image placeholder</div>
            <strong>{p.title}</strong>
            <span className="muted">{p.note}</span>
          </div>
        ))}
      </div>

      <h4>DEVELOPMENT PROJECTS</h4>
      <div className="card-grid">
        {WORK.projects.map((p, i) => (
          <div className="card lg-glass" key={i}>
            <div className="ph-block ph-thumb">image placeholder</div>
            <strong>{p.title}</strong>
            <span className="muted">{p.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaqContent() {
  return (
    <div className="panel">
      {FAQ.map((f, i) => (
        <details key={i} className="faq">
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function ContactContent() {
  return (
    <div className="panel center">
      <div className="ph-block ph-thumb" style={{ maxWidth: 220 }}>mail art placeholder</div>
      <h3>{CONTACT.heading}</h3>
      <p>{CONTACT.body}</p>
      <p>email me at: <strong>{CONTACT.email}</strong></p>
      <a className="btn lg-glass-primary lg-press" href={`mailto:${CONTACT.email}`}>{CONTACT.button}</a>
    </div>
  );
}

export function DownloadsContent() {
  return (
    <div className="panel">
      <p>{DOWNLOADS.intro}</p>
      <div className="card-grid">
        {DOWNLOADS.items.map((d, i) => (
          <div className="card lg-glass" key={i}>
            <div className="ph-block ph-thumb">image placeholder</div>
            <strong>{d.title}</strong>
            <span className="muted">{d.note}</span>
            <a className="btn small lg-glass-primary lg-press" href="#">download</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export const PANELS = {
  about: { title: "about", node: <AboutContent /> },
  links: { title: "links", node: <LinksContent /> },
  work: { title: "work", node: <WorkContent /> },
  faq: { title: "faq", node: <FaqContent /> },
  contact: { title: "contact", node: <ContactContent /> },
  downloads: { title: "downloads", node: <DownloadsContent /> },
};
