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
from datetime import datetime, timedelta
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile
from selenium.common.exceptions import StaleElementReferenceException,NoSuchElementException, ElementNotInteractableException, NoAlertPresentException

def close_extra_tabs(driver):
    
    main_tab = driver.window_handles[0]
    for handle in driver.window_handles[1:]:
        driver.switch_to.window(handle)
        driver.close()
    driver.switch_to.window(main_tab)

def register_metamask_with_hardhat(driver):
    # Need to use XPath to get the elements on the metamask extension
    # Otherwise it triggers Metamask's Javascript security LavaMoat which protects
    # against injections of dangerous code.
    # Can't use a typical searcher like driver.find_element(By.ID, ...)
    # because it uses something like ".execute_script" or "element.get_property()"
    # under the hood.

    # Here since it's a new profile, need to properly instantiate metamask profile.
    # check checkbox agreeing to terms and conditions.
    mm_checkbox = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='onboarding__terms-checkbox']")))
    mm_checkbox.click()

    # Import an existing wallet
    mm_import_button = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Import')]")))
    mm_import_button.click()

    # Select No Thanks for collecting data
    # Put password into login box
    mm_no_thanks = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'No thanks')]")))
    mm_no_thanks.click()

    mm_test_password = "&inA6nUiR5#xXR2"
    mm_phrase = "focus sibling viable dilemma announce puzzle rely change ritual runway depend practice".split(" ")
    print(mm_phrase)

    # Enter secret recovery phrase
    mm_sp_first_input  = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='import-srp__srp-word-0']")))

    mm_phrase_inputs = [driver.find_element(By.ID, f"import-srp__srp-word-{i}") for i in range(12)]
    for i in range(12):
        mm_phrase_inputs[i].send_keys(mm_phrase[i])
    
    # Click enter button 
    mm_confirm_phrase = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Confirm Secret Recovery Phrase')]")))
    mm_confirm_phrase.click()

    # Set the password
    new_password_fields_0 = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@data-testid='create-password-new']")))

    new_password_fields_1 = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@data-testid='create-password-confirm']")))
    
    new_password_fields_0.send_keys(mm_test_password)
    new_password_fields_1.send_keys(mm_test_password)

    new_password_fields_checkbox = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@data-testid='create-password-terms']")))
    new_password_fields_checkbox.click()

    mm_import_my_wallet_button = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Import my wallet')]")))
    mm_import_my_wallet_button.click()

    mm_done_importing = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Done')]")))
    mm_done_importing.click()

    mm_done_importing_1 = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Next')]")))
    mm_done_importing_1.click()

    mm_done_importing_2 = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='pin-extension-done']")))
    mm_done_importing_2.click()
    
    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))
    # Close popup
    mm_close_popup = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='popover-close']")))
    mm_close_popup.click()

    # Click on Networks available
    mm_networks_dropdown = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//p[contains(text(), 'Ethereum Mainnet')]")))
    mm_networks_dropdown.click()

    # add a new network
    mm_new_network = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Add a custom network')]")))
    mm_new_network.click()

    network_name = "localhost8545"
    RPC_url = "http://127.0.0.1:8545/"
    chain_id = "31337"
    currency_symbol = "ETH"
    account_id = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" # from first hardhat account
    account_private_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    mm_network_name = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='networkName']")))
    mm_network_name.send_keys(network_name)

    mm_network_chainId = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='chainId']")))
    mm_network_chainId.send_keys(chain_id)

    mm_network_currency_symbol = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='nativeCurrency']")))
    mm_network_currency_symbol.send_keys(currency_symbol)

    mm_network_rpc_url_dropdown = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='test-add-rpc-drop-down']")))
    mm_network_rpc_url_dropdown.click()

    mm_network_add_rpc_url_button = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Add RPC URL')]")))
    mm_network_add_rpc_url_button.click()

    mm_network_rpc_url = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='rpcUrl']")))
    mm_network_rpc_url.send_keys(RPC_url)

    mm_network_add_rpc_url_button_final = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Add URL')]")))
    mm_network_add_rpc_url_button_final.click()

    mm_network_save = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Save')]")))
    mm_network_save.click()

    mm_networks_dropdown = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//p[contains(text(), 'Ethereum Mainnet')]")))
    mm_networks_dropdown.click()
    
    # select our test network.
    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))

    mm_network_div = WebDriverWait(driver, timeout).until(
    EC.element_to_be_clickable((By.XPATH, f"//p[contains(text(), '{network_name}')]/ancestor::div[@role='button']")))   
    mm_network_div.click()

    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))

    mm_accounts_dropdown = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='account-menu-icon']")))
    mm_accounts_dropdown.click()

    mm_accounts_dropdown_add_account = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='multichain-account-menu-popover-action-button']")))
    mm_accounts_dropdown_add_account.click()

    mm_accounts_dropdown_add_account_import = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='multichain-account-menu-popover-add-imported-account']")))
    mm_accounts_dropdown_add_account_import.click()

    mm_enter_private_key = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='private-key-box']")))
    mm_enter_private_key.send_keys(account_private_key)

    mm_enter_private_key_import = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//button[@data-testid='import-account-confirm-button']")))
    mm_enter_private_key_import.click()

def get_extension_uuid(driver, extension_name):
    uuid_page = "about:debugging#/runtime/this-firefox"
     # check extension is installed
    driver.get(uuid_page)

    uuid_metamask_name = obtain_element(driver, (By.XPATH, f"//span[text()='{extension_name}']"), timeout)
    
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
    
    return uuid

def create_election(driver, title, description, start_time, end_time):
    # This function assumes on your browser you are logged into metamask
    homepage_url = "http://localhost:3000/"
    driver.get(homepage_url)
    
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
    obtain_element(driver, (By.ID, "title"), timeout).send_keys(title)
    obtain_element(driver, (By.ID, "description"), timeout).send_keys(description)
    obtain_element(driver, (By.ID, "startDate"), timeout).send_keys(start_time)
    obtain_element(driver, (By.ID, "endDate"), timeout).send_keys(end_time)
    obtain_element(driver, (By.XPATH, '//input[@value="options"]'), timeout).click()

    # time to fill in the form
    time.sleep(5)

    optionA = driver.find_element(By.XPATH, '//input[@placeholder="Option 1"]')
    optionA.send_keys("10")

    optionB = driver.find_element(By.XPATH, '//input[@placeholder="Option 2"]')
    optionB.send_keys("20")

    driver.find_element(By.XPATH, '//button[@type="submit"]').click()

    # At this point a popup should come up. Accept it.
    # Wait until alert is visible then accept it.
    WebDriverWait(driver, timeout).until(EC.alert_is_present())
    driver.switch_to.alert.accept()


def create_driver_with_profile(profile_path, headless = True):
    options = Options()
    options.add_argument("--window-size=1280x1600")

    
    if headless:
        # To run in headless mode (without opening a window to run it in)
        options.add_argument('--headless')

    firefox_profile = FirefoxProfile(firefox_profile_path)
    options.profile = firefox_profile
    driver = webdriver.Firefox(options=options)
    print(f"successfully created driver with profile path {profile_path}")
    return driver


def register_to_vote(d, registration_url):
    timeout = 20
    d.get(registration_url)

    # Register to vote as a secret holder (yes checked for secret holding by default)
    register = WebDriverWait(d, timeout).until(    
    EC.presence_of_element_located(
        (By.XPATH, "//button[contains(text(), 'Register To Vote')]")))
    
    register.click()

    # Wait until alert is visible then accept it.
    WebDriverWait(d, timeout).until(EC.alert_is_present())
    d.switch_to.alert.accept()

    # Check that right now (before election start time) votes cannot be cast
    voting_unavailable_text = "Voting has not started yet. Please come back when the election is active."
    
    try:
        voting_unavailable = WebDriverWait(d, timeout*6).until(
            EC.presence_of_element_located((
                By.XPATH, f"//div[contains(text(), '{voting_unavailable_text}')]")))
        print("Election testing success: voting was unavailable before election start")
    except NoSuchElementException:
        print("Election testing failure: voting was not unavailable before election start")

if __name__ == '__main__':
    
    firefox_profile_path = "test_profiles/testprofile_0"
    timeout = 20
    driver = create_driver_with_profile(firefox_profile_path, headless=False)
    # Open other drivers to act as participants
    test_drivers = []
    for x in range(1, 3):
        test_driver = create_driver_with_profile(f"test_profiles/testprofile_{x}")
        test_drivers.append(test_driver)


    driver.install_addon("metamask.xpi", temporary=True)
    uuid = get_extension_uuid(driver, "MetaMask")
    if not(uuid == None):
        mm_login_page = f"moz-extension://{uuid}/home.html"
    else:
        print("Extension is not installed, or its uuid could not be found")
        quit()

    print(mm_login_page)
    driver.get(mm_login_page)
    driver.switch_to.window(driver.window_handles[1])
    driver.close()
    driver.switch_to.window(driver.window_handles[0])

    register_metamask_with_hardhat(driver)
    
    # Open a new tab
    driver.switch_to.new_window('tab')

    # List all tab handles
    handles = driver.window_handles

    # Switch to new tab
    driver.switch_to.window(handles[1])

    # Get current number of windows
    existing_windows = set(driver.window_handles)

    # Register and login to website
    authentication_success = register_and_login(driver)
    if not(authentication_success == "success"):
        print("Failed to login")
        quit()

    current_time = datetime.now()
    start_time = (current_time + timedelta(minutes=3))
    end_time = (current_time + timedelta(minutes=6))
    election_shares_reveal_deadline = (current_time + timedelta(minutes = 6 + 3))
    title = f"My_Test_Election_{start_time.strftime('%m/%d/%Y_%H%M')}"
    description = f"My_Test_Election_Description_{start_time.strftime('%m/%d/%Y_%H%M')}"

    print(f"election start time {start_time.strftime('%m/%d/%Y_%H%M')}")
    print(f"election_end_time {end_time.strftime('%m/%d/%Y_%H%M')}")
    print(f"election_shares_reveal_deadline {election_shares_reveal_deadline.strftime('%m/%d/%Y_%H%M')}")
    create_election(driver, 
                    title, 
                    description, 
                    start_time.strftime('%m/%d/%Y_%H%M'), 
                    end_time.strftime('%m/%d/%Y_%H%M'))

    # now that the election is created, we should try registering a few secret holders
    # then double checking the functionality works as it should. 
    all_votes_url = "http://localhost:3000/all-votes"
    driver.get(all_votes_url)

    print(f"Looking for description: '{description}'")

    # Get the element containing the election description, then the parent div vote card
    # all-votes can take a while to load, give a generous timeout.
    election_description_p = WebDriverWait(driver, timeout*6).until(
    EC.presence_of_element_located((By.XPATH, f"//p[contains(text(), '{description}')]"))
)
    election_description_p_parent = election_description_p.parent

    # get the link to the election page.
    election_page_a = election_description_p_parent.find_element(By.XPATH, "//a[contains(text(), 'Signup To Vote')]")
    election_page_href = election_page_a.get_attribute('href')
    print(election_page_href)

    # Have all users register to vote as secret holders.
    register_to_vote(driver, election_page_href)
    for test_driver in test_drivers:
        register_to_vote(test_driver, election_page_href)
    
    # Wait until the election starts
    while datetime.now() < start_time:
        time.sleep(1)
    
    # Now that the election has started, submit votes
    print("The election start time has been reached")
    # slider = WebDriverWait(driver, timeout).until(
    # EC.presence_of_element_located((By.CLASS_NAME, "custom-slider-input")))
    # driver.execute_script
    # ("arguments[0].value = arguments[1]; "
    # "arguments[0].dispatchEvent(new Event('input'));", slider, 0.8)

    # Select option 1
    option1 = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located((By.XPATH, "//input[@id='option-1']")))
    option1.click()

    vote_submit_button = WebDriverWait(driver, timeout).until(    
    EC.presence_of_element_located(
        (By.XPATH, "//button[contains(text(), 'Submit Encrypted Vote')]")))
    vote_submit_button.click()
    
    # driver.quit()
    



