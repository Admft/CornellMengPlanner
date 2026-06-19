export default function SiteFooter({ aboveActionBar = false }: { aboveActionBar?: boolean }) {
  return (
    <footer className={`site-footer${aboveActionBar ? ' site-footer--above-bar' : ''}`}>
      Built by{' '}
      <a
        href="https://www.linkedin.com/in/adamrmoffat/"
        target="_blank"
        rel="noreferrer"
      >
        Adam Moffat
      </a>
      , a Cornell M.Eng. student
    </footer>
  )
}
