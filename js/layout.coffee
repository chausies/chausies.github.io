$(document).ready ->
  document.getElementById('logo_content').innerHTML = \
    """
    <div id="logo">
      <h1>Ajay Shanker Tripathi</h1>
      <div class="slogan">rhythm in randomness, melody in entropy</div>
    </div>
    """
  document.getElementById('footer_content').innerHTML = \
    """
    <div id="footer">
    </div>
    """
  # document.getElementById('sidebar_content').innerHTML = \
  #   """
  #   <div id="sidebar_container">
  #   </div>
  #   """
  navbar = \
  """
  <div id="menubar">
    <ul id="menu">
      <li><a href="index">About Me</a></li>
      <li><a href="academic_record">Academic Record</a></li>
      <li><a href="cv">CV</a></li>
      <li><a href="projects">My Projects</a></li>
      <li><a href="silly_things">Silly Things</a></li>
      <li><a href="find_me">Find Me</a></li>
    </ul>
  </div>
  """
  tag = document.getElementById('navbar')
  curr = tag.getAttribute("curr")
  reg = RegExp("li(?=.*" + curr + ")")
  navbar = navbar.replace(reg, 'li class="current"')
  tag.innerHTML = navbar
