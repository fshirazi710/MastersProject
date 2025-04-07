from authentication import make_driver, register_and_login, obtain_element
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from pathlib import Path
import shutil
import tempfile
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time
import datetime
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile

def close_extra_tabs(driver):
    
    main_tab = driver.window_handles[0]
    for handle in driver.window_handles[1:]:
        driver.switch_to.window(handle)
        driver.close()
    driver.switch_to.window(main_tab)

if __name__ == '__main__':
    uuid_page = "about:debugging#/runtime/this-firefox"
    firefox_profile_path = "test_firefox_profile.masters_project"
    timeout = 20
    options = Options()
    options.add_argument("--window-size=1280x1600")

    # To run in headless mode (without opening a window to run it in)
    # If you want to see the frontend testing for debugging, comment out this line.
    # options.add_argument('--headless')

    firefox_profile = FirefoxProfile(firefox_profile_path)
    options.profile = firefox_profile
    driver = webdriver.Firefox(options=options)

    driver.get(uuid_page)

    uuid_metamask_name = obtain_element(driver, (By.XPATH, "//span[text()='MetaMask']"), timeout)
    # get parent div
    uuid_parent_div = uuid_metamask_name.find_element(By.XPATH, '..')
    uuid_section = uuid_parent_div.find_element(By.TAG_NAME, "section")
    uuid_section_divs = uuid_section.find_elements(By.TAG_NAME, "div")
    uuid = None
    for section_div in uuid_section_divs:
        title_tag = section_div.find_element(By.CLASS_NAME, "fieldpair__title")
        print(title_tag.text)
        if "Internal UUID" in title_tag.text:
            uuid_tag = section_div.find_element(By.TAG_NAME, "dd")
            print(uuid_tag.text)
            uuid = uuid_tag.text
            break
        
    mm_login_page = f"moz-extension://{uuid}/home.html"
    driver.get(mm_login_page)

    # Put password into login box
    metamask_test_password = "G2%Ea3TPq@dX@2"

    # Need to use XPath to get the elements on the metamask extension
    # Otherwise it triggers Metamask's Javascript security LavaMoat which protects
    # against injections of dangerous code.
    # Can't use a typical searcher like driver.find_element(By.ID, ...)
    # because it uses something like ".execute_script" or "element.get_property()"
    # under the hood.
    password_input = WebDriverWait(driver, 15).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='password']")))
    password_input.send_keys(metamask_test_password)

    # Click the unlock button. You should have logged into metamask now.
    unlock_button = driver.find_element(By.XPATH, "//button[text()[contains(.,'Unlock')]]")
    unlock_button.click()

    # Open a new tab
    driver.switch_to.new_window('tab')

    # List all tab handles
    handles = driver.window_handles

    # Switch back to MetaMask (first tab)
    # driver.switch_to.window(handles[0])

    # Switch to new tab (second)
    driver.switch_to.window(handles[1])

    # Get current number of windows
    existing_windows = set(driver.window_handles)

    # Register and login to website
    authentication_success = register_and_login(driver)
    if authentication_success == "success":
        print("logged in successfully")
    else:
        print("Failed to login")

    # Navigate to create election page from homepage
    create_vote_btn = driver.find_element(By.LINK_TEXT, "Create Vote")  # or By.ID, etc.
    create_vote_btn.click()

    # Wait till the popup appears
    WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) > len(existing_windows))
    
    # Get handle of new window
    new_windows = set(driver.window_handles) - existing_windows
    metamask_popup_handle = new_windows.pop()

    # Switch to metamask popup window
    driver.switch_to.window(metamask_popup_handle)

    # Click the connect button
    WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.XPATH, "//button[text()='Connect']")))
    driver.find_element(By.XPATH, "//button[text()='Connect']").click()

    # Switch back to create election window
    driver.switch_to.window(handles[1])

    # Input form data to create election
    suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
    test_title = f"My Test Election {suffix}"
    test_description = f"My Test Election Description {suffix}"
    test_start_time = "04-04-2025T19:30"
    test_end_time = "05-05-2025T19:30"
    id_box = obtain_element(driver, (By.ID, "title"), timeout) 
    id_box.send_keys(test_title)

    obtain_element(driver, (By.ID, "description"), timeout).send_keys(test_description)

    start_time_box = obtain_element(driver, (By.ID, "startDate"), timeout)
    start_time_box.send_keys(test_start_time)

    obtain_element(driver, (By.ID, "endDate"), timeout).send_keys(test_end_time)

    optionA = driver.find_element(By.XPATH, '//input[@placeholder="Option 1"]')
    optionA.send_keys("my test option a")

    optionB = driver.find_element(By.XPATH, '//input[@placeholder="Option 2"]')
    optionB.send_keys("my test option b")

    submitButton = driver.find_element(By.XPATH, '//button[@type="submit"]')
    submitButton.click()

    # At this point a popup should come up. Accept it.
    # Wait until alert is visible then accept it.
    WebDriverWait(driver, timeout).until(EC.alert_is_present())
    driver.switch_to.alert.accept()
    driver.quit()
    



