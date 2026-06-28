// StaticSection.jsx — renders a chunk of your original, untouched HTML so the
// design stays pixel-identical. It's static markup (no scripts), so injecting
// it as HTML is safe here.
export default function StaticSection({ html, as: Tag = "div" }) {
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />;
}
