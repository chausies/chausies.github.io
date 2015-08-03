$(document).ready ->
  $ ->
    $('#sidebar_content').load 'html_snips/sidebar.html'
    return
  $ ->
    $('#logo_content').load 'html_snips/logo.html'
    return
  $ ->
    $('#footer_content').load 'html_snips/footer.html'
    return
  navbar = \
  """
  <div id="menubar">
    <ul id="menu">
      <li><a href="index.html">About Me</a></li>
      <li><a href="academic_record.html">Academic Record</a></li>
      <li><a href="#">CV</a></li>
      <li><a href="#">My Projects</a></li>
      <li><a href="#">Silly Things</a></li>
      <li><a href="find_me.html">Find Me</a></li>
    </ul>
  </div>
  """
  tag = document.getElementById('navbar')
  curr = tag.getAttribute("curr")
  reg = RegExp("li(?=.*" + curr + ")")
  navbar = navbar.replace(reg, 'li class="current"')
  tag.innerHTML = navbar
