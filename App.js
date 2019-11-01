import React, { Component } from 'react';
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  AppRegistry,
  StyleSheet,
  Text,
  Alert,
  View,
  Dimensions,
  TouchableHighlight,
} from 'react-native';
import TabNavigator from 'react-native-tab-navigator';
import Calendar from './Calendar.js';
import Profile from './Profile.js';
import Login from './Login.js';

console.disableYellowBox = true;

const deviceW = Dimensions.get('window').width;
const basePx = 375;
function px2dp(px) {
  return (px * deviceW) / basePx;
}
export const baseURL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/'
    : 'http://localhost:3000/';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTab: 'calendar',
      year_level: '',
      courses: [],
      sex: '0',
      number_of_ratings: '0.0',
      kindness_rating: '0.0',
      patience_rating: '0.0',
      hard_working_rating: '0.0',
      authentication_token: '',
      password: '',
      user_id: '',
      email: '',
      name: '',
      scheduleArray: [],
      loggedIn: false,
    };
  }

  changeLogVisible() {
    this.setState({ loggedIn: !this.state.loggedIn });
  }

  changeUsername(data) {
    this.setState({ user_id: data });
  }

  changePassword(data) {
    this.setState({ password: data });
  }

  changeYearLevel(data) {
    this.setState({ year_level: data });
  }

  changeCourses(data) {
    this.setState({ courses: data });
  }

  changeSex(data) {
    this.setState({ sex: data });
  }

  changeNumberOfRatings(data) {
    this.setState({ number_of_ratings: data });
  }

  changeKindnessRating(data) {
    this.setState({ kindness_rating: data });
  }

  changePatienceRating(data) {
    this.setState({ patience_rating: data });
  }

  changeHardWorkingRating(data) {
    this.setState({ hard_working_rating: data });
  }

  changeAuthenticationToken(data) {
    this.setState({ authentication_token: data });
  }

  changeEmail(data) {
    this.setState({ email: data });
  }

  changeName(data) {
    this.setState({ name: data });
  }

  changeScheduleArray(data) {
    this.setState({ scheduleArray: data });
  }

  addScheduleArray(data) {
    this.setState({ scheduleArray: this.state.scheduleArray.concat(data) });
  }

  clearScheduleArray() {
    this.setState({ scheduleArray: [] });
  }

  render() {
    if (this.state.loggedIn) {
      return (
        <TabNavigator style={styles.container}>
          <TabNavigator.Item
            selected={this.state.selectedTab === 'calendar'}
            title="Calendar"
            selectedTitleStyle={{ color: '#3496f0' }}
            renderIcon={() => (
              <Icon name="calendar" size={px2dp(22)} color="#666" />
            )}
            renderSelectedIcon={() => (
              <Icon name="calendar" size={px2dp(22)} color="#3496f0" />
            )}
            onPress={() => this.setState({ selectedTab: 'calendar' })}>
            <Calendar
              /* States */
              year_level={this.state.year_level}
              courses={this.state.courses}
              sex={this.state.sex}
              number_of_ratings={this.state.number_of_ratings}
              kindness_rating={this.state.kindness_rating}
              patience_rating={this.state.patience_rating}
              hard_working_rating={this.state.hard_working_rating}
              password={this.state.password}
              user_id={this.state.user_id}
              email={this.state.email}
              name={this.state.name}
              scheduleArray={this.state.scheduleArray}
              /* Functions */
              scheduleArrayAdd={this.addScheduleArray.bind(this)}
              scheduleArrayClear={this.clearScheduleArray.bind(this)}
              scheduleArrayChange={this.changeScheduleArray.bind(this)}
            />
          </TabNavigator.Item>

          <TabNavigator.Item
            selected={this.state.selectedTab === 'profile'}
            title="Profile"
            selectedTitleStyle={{ color: '#3496f0' }}
            renderIcon={() => (
              <Icon name="user" size={px2dp(22)} color="#666" />
            )}
            renderSelectedIcon={() => (
              <Icon name="user" size={px2dp(22)} color="#3496f0" />
            )}
            onPress={() => this.setState({ selectedTab: 'profile' })}>
            <Profile
              /* States */
              year_level={this.state.year_level}
              courses={this.state.courses}
              sex={this.state.sex}
              number_of_ratings={this.state.number_of_ratings}
              kindness_rating={this.state.kindness_rating}
              patience_rating={this.state.patience_rating}
              hard_working_rating={this.state.hard_working_rating}
              authentication_token={this.state.authentication_token}
              password={this.state.password}
              user_id={this.state.user_id}
              email={this.state.email}
              name={this.state.name}
              /* Functions */
              yearLevelChange={this.changeYearLevel.bind(this)}
              coursesChange={this.changeCourses.bind(this)}
              sexChange={this.changeSex.bind(this)}
              numberOfRatingsChange={this.changeNumberOfRatings.bind(this)}
              kindnessRatingChange={this.changeKindnessRating.bind(this)}
              patienceRatingChange={this.changePatienceRating.bind(this)}
              hardWorkingRatingChange={this.changeHardWorkingRating.bind(this)}
              authenticationTokenChange={this.changeAuthenticationToken.bind(
                this
              )}
              emailChange={this.changeEmail.bind(this)}
              nameChange={this.changeName.bind(this)}
              usernameChange={this.changeUsername.bind(this)}
              passwordChange={this.changePassword.bind(this)}
            />
          </TabNavigator.Item>
        </TabNavigator>
      );
    } else {
      return (
        <Login
          /* Functions */
          yearLevelChange={this.changeYearLevel.bind(this)}
          coursesChange={this.changeCourses.bind(this)}
          sexChange={this.changeSex.bind(this)}
          numberOfRatingsChange={this.changeNumberOfRatings.bind(this)}
          kindnessRatingChange={this.changeKindnessRating.bind(this)}
          patienceRatingChange={this.changePatienceRating.bind(this)}
          hardWorkingRatingChange={this.changeHardWorkingRating.bind(this)}
          authenticationTokenChange={this.changeAuthenticationToken.bind(this)}
          emailChange={this.changeEmail.bind(this)}
          nameChange={this.changeName.bind(this)}
          usernameChange={this.changeUsername.bind(this)}
          passwordChange={this.changePassword.bind(this)}
          logVisibleChange={this.changeLogVisible.bind(this)}
          scheduleArrayAdd={this.addScheduleArray.bind(this)}
          scheduleArrayClear={this.clearScheduleArray.bind(this)}
          scheduleArrayChange={this.changeScheduleArray.bind(this)}
          /* States */
          password={this.state.password}
          user_id={this.state.user_id}
          scheduleArray={this.state.scheduleArray}
        />
      );
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  shareText: {
    fontSize: 20,
    margin: 10,
  },
});
