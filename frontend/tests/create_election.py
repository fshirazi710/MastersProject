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
from selenium.webdriver.support.expected_conditions import invisibility_of_element_located
from selenium.common.exceptions import TimeoutException

def close_extra_tabs(driver):
    
    main_tab = driver.window_handles[0]
    for handle in driver.window_handles[1:]:
        driver.switch_to.window(handle)
        driver.close()
    driver.switch_to.window(main_tab)

def create_metamask_wallet(driver):
    # THIS FUNCTION ASSUMES YOU ARE THE HARDHAT REGISTRATION/IMPORT WALLET PAGE

    # check checkbox agreeing to terms and conditions.
    obtain_element(driver, (By.XPATH, "//input[@id='onboarding__terms-checkbox']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'Create a new wallet')]"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'No thanks')]"), timeout).click()

    # Create password
    mm_password = f"MetaMaskPassword_{datetime.now().strftime('%m_%d_%Y_%H%M')}"
    obtain_element(driver, (By.XPATH, "//input[@data-testid='create-password-new']"), timeout).send_keys(mm_password)
    obtain_element(driver, (By.XPATH, "//input[@data-testid='create-password-confirm']"), timeout).send_keys(mm_password)
    obtain_element(driver, (By.XPATH, "//input[@data-testid='create-password-terms']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[@data-testid='create-password-wallet']"), timeout).click()

    # Secure wallet
    obtain_element(driver, (By.XPATH, "//button[@data-testid='secure-wallet-recommended']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[@data-testid='recovery-phrase-reveal']"), timeout).click()

    chips_div = obtain_element(driver, (By.XPATH, "//div[@data-testid='recovery-phrase-chips']"), timeout)
    security_phrase = []

    all_chips_divs = chips_div.find_elements(By.CLASS_NAME, "recovery-phrase__chip-item")
    
    for x in range(0, 12):
        curr_chip = all_chips_divs[x]
        recovery_phrase_chip = curr_chip.find_element(By.XPATH, f"//div[@data-testid='recovery-phrase-chip-{x}']")
        security_phrase.append(recovery_phrase_chip.text)
    
    print("Recovery Phrase for this wallet:")
    print(" ".join(security_phrase))

    # Go to next page
    obtain_element(driver, (By.XPATH, "//button[@data-testid='recovery-phrase-next']"), timeout).click()

    # Fill in the empty boxes.
    input_elements = driver.find_elements(By.TAG_NAME, "input")
    for input_element in input_elements:
        parent_div = input_element.find_element(By.XPATH, '..').find_element(By.XPATH, '..')
        number_div = parent_div.find_element(By.CLASS_NAME, "recovery-phrase__chip-item__number")

        print(f"label of current div: {number_div.text[0]}")
        index = int(number_div.text[0]) - 1
        print(f"index of current recovery chip is '{index}'")
        print(f"From the array, that is element '{security_phrase[index]}'")
        input_element.send_keys(security_phrase[index])

    confirm_button = WebDriverWait(driver, 10 * 1000).until(
    EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='recovery-phrase-confirm']"))
    )

    confirm_button.click()

    # Click done
    done_button = WebDriverWait(driver, 10 * 1000).until(
    EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='onboarding-complete-done']"))
    )

    done_button.click()

    obtain_element(driver, (By.XPATH, "//button[@data-testid='pin-extension-next']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[@data-testid='pin-extension-done']"), timeout).click()

    account_dict = {
        "password" : mm_password,
        "recovery_phrase" : security_phrase
    }

    return account_dict


def register_metamask_with_hardhat(driver, network, acc):
    # Need to use XPath to get the elements on the metamask extension
    # Otherwise it triggers Metamask's Javascript security LavaMoat which protects against injections of dangerous code.

    # Create Metamask account    
    account_dict = create_metamask_wallet(driver)
    print("Account dict from creating hardhat wallet:")
    print(account_dict)
   
    ### LOGGED INTO METAMASK ACCOUNT FROM HERE. 

    # Wait for loading overlay to disappear
    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))

    # Close popup
    obtain_element(driver, (By.XPATH, "//button[@data-testid='popover-close']"), timeout).click()

    # View all networks
    obtain_element(driver, (By.XPATH, "//p[contains(text(), 'Ethereum Mainnet')]"), timeout).click()

    # Add a new network
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'Add a custom network')]"), timeout).click()
    obtain_element(driver, (By.XPATH, "//input[@id='networkName']"), timeout).send_keys(network["network_name"])
    obtain_element(driver, (By.XPATH, "//input[@id='chainId']"), timeout).send_keys(network["chain_id"])
    obtain_element(driver, (By.XPATH, "//input[@id='nativeCurrency']"), timeout).send_keys(network["currency_symbol"])

    # Decide Network RPC url
    obtain_element(driver, (By.XPATH, "//button[@data-testid='test-add-rpc-drop-down']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'Add RPC URL')]"), timeout).click()
    obtain_element(driver, (By.XPATH, "//input[@id='rpcUrl']"), timeout).send_keys(network["RPC_url"])
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'Add URL')]"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[contains(text(), 'Save')]"), timeout).click()

    # Click button to open up list of all networks, including the one we just added.
    obtain_element(driver, (By.XPATH, "//p[contains(text(), 'Ethereum Mainnet')]"), timeout).click()

    # Wait for Overlay to disappear.
    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))

    # Select our newly added network.
    mm_network_div = WebDriverWait(driver, timeout).until(
    EC.element_to_be_clickable((By.XPATH, f"//p[contains(text(), '{network["network_name"]}')]/ancestor::div[@role='button']")))   
    mm_network_div.click()

    # Wait for overlay to disappear.
    WebDriverWait(driver, timeout).until(
    EC.invisibility_of_element_located((By.CLASS_NAME, "loading-overlay")))

    # Now that our newly added network is added and selected, let's add an account to it using the passed in acc dictionary.
    obtain_element(driver, (By.XPATH, "//button[@data-testid='account-menu-icon']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[@data-testid='multichain-account-menu-popover-action-button']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//button[@data-testid='multichain-account-menu-popover-add-imported-account']"), timeout).click()
    obtain_element(driver, (By.XPATH, "//input[@id='private-key-box']"), timeout).send_keys(acc["account_private_key"])
    obtain_element(driver, (By.XPATH, "//button[@data-testid='import-account-confirm-button']"), timeout).click()


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

    # Get current number of windows
    existing_windows = set(driver0.window_handles)

    # Navigate to create election page from homepage
    create_vote_btn = driver.find_element(By.LINK_TEXT, "Create Vote Session")  # or By.ID, etc.
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

    # List all tab handles
    handles = driver.window_handles

    # Switch back to create election window
    driver.switch_to.window(handles[1])

    # Input form data to create election
    obtain_element(driver, (By.ID, "title"), timeout).send_keys(title)
    obtain_element(driver, (By.ID, "description"), timeout).send_keys(description)
    obtain_element(driver, (By.ID, "startDate"), timeout).send_keys(start_time)
    obtain_element(driver, (By.ID, "endDate"), timeout).send_keys(end_time)

    # Always pick the slider - the system only works with the slider. 
    obtain_element(driver, (By.XPATH, '//input[@value="slider"]'), timeout).click()

    # Click the up button once to set the minimum slider value to 1. The Maximum slider value can stay at 100.
    driver.execute_script("document.getElementById('sliderMin').stepUp();")

    # Click the up button 5 times to set the step increment to 5. 
    for x in range (0, 4):
        driver.execute_script("document.getElementById('sliderStep').stepUp();")

    # Time to fill in the form
    time.sleep(10)

    driver.find_element(By.XPATH, '//button[@type="submit"]').click()

    # At this point a popup should come up. Accept it.
    # Wait until alert is visible then accept it.
    WebDriverWait(driver, timeout).until(EC.alert_is_present())
    driver.switch_to.alert.accept()


def register_to_vote(d, registration_url):
    timeout = 20
    d.get(registration_url)

    # Since all drivers are using the same metamask account, you'll get a popup asking to connect if it's not the first driver.
    # Get current number of windows
    existing_windows = set(driver0.window_handles)

    # Check if the connection popup shows up.

    try:
        WebDriverWait(d, timeout).until(lambda d: len(d.window_handles) > len(existing_windows))

        # Get handle of new window
        new_windows = set(d.window_handles) - existing_windows
        metamask_popup_handle = new_windows.pop()

        # Switch to metamask popup window
        d.switch_to.window(metamask_popup_handle)

        # Click the connect button
        obtain_element(d, (By.XPATH, "//button[text()='Connect']"), timeout * 100).click()

        # List all tab handles
        handles = d.window_handles

        # Switch back to current window
        d.switch_to.window(handles[1])

        d.get(registration_url)

        # Make sure the voting page has showed up by checking for the timeline text
        obtain_element(d, (By.XPATH, "//h3[text()='Timeline']"), timeout * 100)

    except TimeoutException:
        # If you're in here it's because you're the main window
        print("In the main window, no need to reconnect.")


    # Create a random vote session key password.
    current_time = datetime.now()
    vote_session_key_password = f"My_vote_session_key_password_{current_time.strftime('%m/%d/%Y_%H%M')}"

    # Register to vote as a secret holder (yes checked for secret holding by default)
    obtain_element(d, (By.ID, "reg-password"), timeout * 100).send_keys(vote_session_key_password)
    obtain_element(d, (By.ID, "reg-confirm-password"), timeout * 100).send_keys(vote_session_key_password)
    obtain_element(d, (By.XPATH, "//button[contains(text(), 'Join as Holder & Deposit')  ]  "), timeout*100).click()

    # Get current number of windows
    existing_windows = set(driver0.window_handles)

    # Wait till the MetaMask popup appears
    WebDriverWait(d, timeout).until(lambda d: len(d.window_handles) > len(existing_windows))
    
    # Get handle of new window
    new_windows = set(d.window_handles) - existing_windows
    metamask_popup_handle = new_windows.pop()

    # Switch to metamask popup window
    d.switch_to.window(metamask_popup_handle)

    # Accept everything on metamask
    obtain_element(d, (By.XPATH, "//button[contains(text(), 'Confirm') ]"), timeout).click()
    obtain_element(d, (By.XPATH, "//input[@type='checkbox']"), timeout).click()
    obtain_element(d, (By.XPATH, "//button[@data-testid='confirm-alert-modal-submit-button']"), timeout).click()

    # List all tab handles then switch back to create election window
    handles = d.window_handles
    d.switch_to.window(handles[1])

    # Check that right now (before election start time) votes cannot be cast
    voting_unavailable_text = "Voting has not started yet. Please come back when the election is active."
    
    try:
        obtain_element(d, (By.XPATH, f"//div[contains(text(), '{voting_unavailable_text}')]"), timeout)
        print("Registration success: and voting is unavailable before election start")
    except NoSuchElementException:
        print("Registration failure: voting was not unavailable before election start")

    return vote_session_key_password



def create_driver_with_profile(firefox_profile_path, headless = True):
    options = Options()
    options.add_argument("--window-size=1280x1600")

    
    if headless:
        # To run in headless mode (without opening a window to run it in)
        options.add_argument('--headless')

    firefox_profile = FirefoxProfile(firefox_profile_path)
    options.profile = firefox_profile
    driver = webdriver.Firefox(options=options)
    print(f"successfully created driver with profile path {firefox_profile_path}")
    return driver

def setup_hardhat_driver(network, acc, firefox_profile_path, headless=False):
    timeout = 20
    driver = create_driver_with_profile(firefox_profile_path, headless=headless)
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

    register_metamask_with_hardhat(driver, network, acc)

    return driver


if __name__ == '__main__':
    
    timeout = 20

    hardhat_network = {
        "network_name" : "localhost8545",
        "RPC_url" : "http://127.0.0.1:8545/",
        "chain_id" : "31337",
        "currency_symbol" : "ETH"
    }

    hardhat_acc0 = {
        "wallet_address" : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "account_private_key" : "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    }

    hardhat_acc1 = {
        "wallet_address" : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "account_private_key" : "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    }

    hardhat_acc2 = {
        "wallet_address" : "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "account_private_key" : "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
    }
    

    driver0 = setup_hardhat_driver(hardhat_network, hardhat_acc0, "test_profiles/testprofile_0", headless=False)
    # driver1 = setup_hardhat_driver(hardhat_network, hardhat_acc1, "test_profiles/testprofile_1", headless=False)
    # driver2 = setup_hardhat_driver(hardhat_network, hardhat_acc2, "test_profiles/testprofile_2", headless=False)
    
    # # Register and login to website

    # Open a new tab
    # driver.switch_to.new_window('tab')

    # # List all tab handles
    # handles = driver.window_handles

    # # Switch to new tab
    # driver.switch_to.window(handles[1])

    # authentication_success = register_and_login(driver0)
    # if not(authentication_success == "success"):
    #     print("Failed to login")
    #     quit()

    # current_time = datetime.now()
    # start_time = (current_time + timedelta(minutes = 7))
    # end_time = (current_time + timedelta(minutes = 12))
    # title = f"My_Test_Election_{start_time.strftime('%m_%d_%Y_%H%M')}"
    # description = f"My_Test_Election_Description_{start_time.strftime('%m_%d_%Y_%H%M')}"

    # create_election(driver0, title, description, start_time.strftime('%m_%d_%Y_%H%M'), end_time.strftime('%m_%d_%Y_%H%M'))

    # # now that the election is created, we should try registering a few secret holders
    # # then double checking the functionality works as it should. 
    # driver0.get("http://localhost:3000/all-vote-sessions")
    
    # time.sleep(5)
    # print(f"Looking for description: '{description}'")

    # # Get the element containing the election description, then the parent div vote card
    # # all-votes can take a while to load, give a generous timeout. Wait till a single section shows up.
    # WebDriverWait(driver0, timeout*66).until(EC.presence_of_element_located((By.TAG_NAME, "section")))

    # # Get all sections, join vote sessions, active vote sessions and ended vote sessions.
    # sections = driver0.find_elements(By.TAG_NAME, "section")

    # # Get the join vote section
    # for section in sections:
    #     section_header = section.find_element(By.TAG_NAME, "h2")
    #     print(section_header.text)

    #     if "Join Vote Sessions" in section_header.text:
    #         joining_section = section
    
    # # Get the div inside the section
    # section_div = joining_section.find_element(By.TAG_NAME, "div")

    # # Get all voting session divs in the section.
    # voting_session_divs = section_div.find_elements(By.CLASS_NAME, "vote-card")

    # for div in voting_session_divs:
    #     session_description = div.find_element(By.TAG_NAME, "p")
    #     print(f"Session description text from html is:\n'{session_description.text}'")

    #     if description in session_description.text:
    #         session_href_a = div.find_element(By.TAG_NAME, "a")
    #         election_page_href = session_href_a.get_attribute('href')
    #         print(election_page_href)
    #     else:
    #         print("Not in the right session box, try the next one")

    # # Have all users register to vote as secret holders.
    # vote_session_key_password_0 = register_to_vote(driver0, election_page_href)
    # vote_session_key_password_1 = register_to_vote(driver1, election_page_href)
    # vote_session_key_password_2 = register_to_vote(driver2, election_page_href)
    
#     # Wait until the election starts
#     while datetime.now() < start_time:
#         time.sleep(1)
    
#     # Now that the election has started, submit votes
#     print("The election start time has been reached")
#     # slider = WebDriverWait(driver, timeout).until(
#     # EC.presence_of_element_located((By.CLASS_NAME, "custom-slider-input")))
#     # driver.execute_script
#     # ("arguments[0].value = arguments[1]; "
#     # "arguments[0].dispatchEvent(new Event('input'));", slider, 0.8)

#     # Select option 1
#     option1 = WebDriverWait(driver, timeout).until(    
#     EC.presence_of_element_located((By.XPATH, "//input[@id='option-1']")))
#     option1.click()

#     vote_submit_button = WebDriverWait(driver, timeout).until(    
#     EC.presence_of_element_located(
#         (By.XPATH, "//button[contains(text(), 'Submit Encrypted Vote')]")))
#     vote_submit_button.click()
    
    # driver.quit()
    



