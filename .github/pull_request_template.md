> **PR Template to keep the history clean and work with `git log --oneline`**
1. PR summary should have <= 50 characters\
```CLOUD-#: JIRA ticket subject (cutoff at 50)```\
The merged commit should include the PR number `(#123)`\
The GitHub commit history will then have a hyperlink to the Jira ticket & PR which is helpful

2. Remove redundant or inconsequential commit messages

3. Capitalize commit phrase but do not end with a period
  
4. Use the imperative term in commit phrase\
Good > CLOUD-100: Upgrade a from 1 to 2\
Bad &nbsp; > CLOUD-100: Upgraded a from 1 to 2\
Bad &nbsp; > CLOUD-100: Upgrades a from 1 to 2\
Bad &nbsp; > CLOUD-100: Upgrading a from 1 to 2

5. Separate subject from body with a blank line (Github UI will do this automatically and add bullet points)
6. Example of good "Squash and merge" summary line with commit body
    ```
    CLOUD-100: Upgrade apache dependencies (#500)

    * Upgrade a from 1 to 2
    * Upgrade b from 2 to 3
    * Upgrade c from 3 to 4
    ```
